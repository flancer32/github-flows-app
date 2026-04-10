// @ts-check

/**
 * @namespace Github_Flows_App_Event_Attribute_Provider
 * @description Host-provided event attribute provider for github-flows-app.
 */
export default class Github_Flows_App_Event_Attribute_Provider {
  constructor() {
    /**
     * Measure request payload size in bytes.
     *
     * @param {*} payload
     * @returns {number}
     */
    const measurePayloadSize = payload => {
      if (payload === undefined) {
        return 0;
      }
      if (typeof payload === "string" || Buffer.isBuffer(payload)) {
        return Buffer.byteLength(payload);
      }
      return Buffer.byteLength(JSON.stringify(payload));
    };

    /**
     * Derive size-based flags from payload size.
     *
     * @param {number} sizeBytes
     * @returns {object}
     */
    const buildSizeFlags = sizeBytes => ({
      sizeLess10K: sizeBytes < 10_000,
      sizeLess100K: sizeBytes < 100_000,
      sizeLess1M: sizeBytes < 1_000_000,
      sizeLess2M: sizeBytes < 2_000_000,
    });

    /**
     * Resolve event attributes for the request.
     *
     * @param {object} [params]
     * @param {*} [params.payload]
     */
    this.getAttributes = async function ({ payload } = {}) {
      const sizeBytes = measurePayloadSize(payload);
      return {
        ...buildSizeFlags(sizeBytes),
      };
    };
  }
}
