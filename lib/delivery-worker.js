'use strict';

const http = require('http');
const https = require('https');

const GROUP_NAME = 'sparkui-workers';
const CONSUMER_NAME = `worker-${process.pid}`;
const MAX_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 1000; // 1s, 2s, 4s, 8s, 16s

class DeliveryWorker {
  /**
   * @param {import('./redis').RedisStore} redisStore
   * @param {object} opts
   * @param {string} opts.openclawHooksUrl
   * @param {string} opts.openclawHooksToken
   * @param {function} opts.getPageMeta - async (pageId) => page meta from store
   * @param {function} opts.getPageCallback - (pageId) => { callbackUrl, callbackToken }
   * @param {function} opts.getPageOpenclaw - (pageId) => openclaw config
   */
  constructor(redisStore, opts = {}) {
    this.redis = redisStore;
    this.hooksUrl = opts.openclawHooksUrl || null;
    this.hooksToken = opts.openclawHooksToken || null;
    this.getPageMeta = opts.getPageMeta || (async () => null);
    this.getPageCallback = opts.getPageCallback || (() => null);
    this.getPageOpenclaw = opts.getPageOpenclaw || (() => null);
    this._running = false;
    this._inFlight = 0;
    this._shutdownResolve = null;
  }

  async start() {
    await this.redis.ensureDeliveryGroup(GROUP_NAME);
    this._running = true;
    console.log('[delivery] Worker started');
    this._loop();
  }

  async stop() {
    this._running = false;
    console.log('[delivery] Worker stopping, waiting for in-flight...');
    if (this._inFlight > 0) {
      await new Promise((resolve) => {
        this._shutdownResolve = resolve;
        // Force resolve after 10s
        setTimeout(resolve, 10000);
      });
    }
    console.log('[delivery] Worker stopped');
  }

  async _loop() {
    while (this._running) {
      try {
        const events = await this.redis.readDelivery(GROUP_NAME, CONSUMER_NAME, 5, 3000);
        for (const event of events) {
          this._inFlight++;
          try {
            await this._processEvent(event);
            await this.redis.ackDelivery(GROUP_NAME, event.id);
          } catch (err) {
            console.error(`[delivery] Failed to process event ${event.id}:`, err.message);
            // Will be retried via pending list or dead-lettered
          } finally {
            this._inFlight--;
          }
        }
      } catch (err) {
        if (this._running) {
          console.error('[delivery] Read error:', err.message);
          await this._sleep(2000);
        }
      }
    }
    if (this._shutdownResolve) this._shutdownResolve();
  }

  async _processEvent(event) {
    const { pageId, type, data, meta } = event;
    const errors = [];

    // 1. Forward to callback URL if configured
    const cb = this.getPageCallback(pageId);
    if (cb && cb.callbackUrl) {
      try {
        await this._postWithRetry(cb.callbackUrl, {
          type,
          pageId,
          data: data || {},
          timestamp: event.timestamp || Date.now(),
        }, cb.callbackToken ? { Authorization: `Bearer ${cb.callbackToken}` } : {});
        console.log(`[delivery] Callback forwarded: ${type} for page ${pageId}`);
      } catch (err) {
        errors.push(`callback: ${err.message}`);
      }
    }

    // 2. Forward to OpenClaw hooks if configured
    const oc = this.getPageOpenclaw(pageId);
    if (oc && oc.enabled && this.hooksUrl && this.hooksToken) {
      const eventTypes = oc.eventTypes || ['completion'];
      if (eventTypes.includes(type)) {
        try {
          const pageMeta = await this.getPageMeta(pageId);
          const pageTitle = (pageMeta && pageMeta.meta && pageMeta.meta.title) || 'Untitled';
          const templateName = (pageMeta && pageMeta.meta && pageMeta.meta.template) || 'unknown';

          // Build a human-readable summary for the agent to relay
          const eventData = data || {};
          let humanMessage;
          if (type === 'completion' && (eventData.action || eventData.decision)) {
            const decision = eventData.decision || eventData.action || 'completed';
            const comment = eventData.comment ? ` — "${eventData.comment}"` : '';
            humanMessage = `⚡ SparkUI: "${pageTitle}" was **${decision}**${comment}`;
          } else if (type === 'completion' && eventData.rating !== undefined) {
            const feedback = eventData.feedback ? `: ${eventData.feedback}` : '';
            humanMessage = `⚡ SparkUI: "${pageTitle}" received feedback — ${eventData.rating}/5 stars${feedback}`;
          } else if (type === 'completion' && eventData.selectedItem) {
            humanMessage = `⚡ SparkUI: "${pageTitle}" — selected: **${eventData.selectedItem}**`;
          } else if (type === 'completion' && eventData.vote) {
            humanMessage = `⚡ SparkUI: "${pageTitle}" — vote cast for: **${eventData.vote}**`;
          } else {
            humanMessage = `⚡ SparkUI ${type} event from "${pageTitle}": ${JSON.stringify(eventData)}`;
          }

          // Also include structured data for programmatic use
          const message = humanMessage + '\n\n<sparkui-event>' + JSON.stringify({
            _sparkui: true,
            type,
            pageId,
            template: templateName,
            title: pageTitle,
            data: eventData,
            timestamp: event.timestamp || Date.now(),
          }) + '</sparkui-event>';

          const hooksPayload = {
            message,
            deliver: true,
            channel: oc.channel || 'slack',
          };
          if (oc.to) hooksPayload.to = oc.to;
          // Note: sessionKey requires hooks.allowRequestSessionKey=true in OpenClaw.
          // Prefer using 'to' (channel ID) for routing — works out of the box.
          if (oc.sessionKey) hooksPayload.sessionKey = oc.sessionKey;

          await this._postWithRetry(this.hooksUrl, hooksPayload, { Authorization: `Bearer ${this.hooksToken}` });
          console.log(`[delivery] OpenClaw forwarded: ${type} for page ${pageId}`);
        } catch (err) {
          errors.push(`openclaw: ${err.message}`);
        }
      }
    }

    if (errors.length > 0) {
      const attempts = (event.attempts || 0) + 1;
      if (attempts >= MAX_ATTEMPTS) {
        console.error(`[delivery] Dead-lettering event ${event.id} after ${attempts} attempts: ${errors.join('; ')}`);
        await this.redis.deadLetter(event, errors.join('; '));
      } else {
        // Re-queue with incremented attempts
        const backoffMs = BACKOFF_BASE_MS * Math.pow(2, attempts - 1);
        console.warn(`[delivery] Retrying event ${event.id} in ${backoffMs}ms (attempt ${attempts}/${MAX_ATTEMPTS}): ${errors.join('; ')}`);
        await this._sleep(backoffMs);
        await this.redis.queueDelivery(pageId, type, data, { ...(meta || {}), _retryCount: attempts });
      }
    }
  }

  /**
   * POST JSON to a URL with retries and exponential backoff.
   */
  async _postWithRetry(url, body, extraHeaders = {}, maxRetries = 3) {
    let lastErr;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await this._postJson(url, body, extraHeaders);
        return;
      } catch (err) {
        lastErr = err;
        if (attempt < maxRetries - 1) {
          await this._sleep(BACKOFF_BASE_MS * Math.pow(2, attempt));
        }
      }
    }
    throw lastErr;
  }

  /**
   * POST JSON to a URL. Returns a promise.
   */
  _postJson(urlStr, body, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);
      const url = new URL(urlStr);
      const isHttps = url.protocol === 'https:';
      const transport = isHttps ? https : http;

      const headers = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': 'SparkUI/1.1',
        ...extraHeaders,
      };

      const req = transport.request({
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers,
      }, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => { responseBody += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${responseBody.slice(0, 200)}`));
          } else {
            resolve(responseBody);
          }
        });
      });

      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  _sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
}

module.exports = { DeliveryWorker };
