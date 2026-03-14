export interface TencentAsrOptions {
  readonly secretId: string;
  readonly secretKey: string;
  readonly timeoutMs?: number;
}

export interface AsrResult {
  readonly text: string;
}

export async function recognizeSpeech(audioBase64: string, options: TencentAsrOptions): Promise<AsrResult> {
  const tencentcloud = await import("tencentcloud-sdk-nodejs");
  const AsrClient = tencentcloud.asr.v20190614.Client;
  const client = new AsrClient({ credential: { secretId: options.secretId, secretKey: options.secretKey }, region: "ap-guangzhou" });
  const resp = await client.SentenceRecognition({
    EngSerViceType: "16k_zh", SourceType: 1, VoiceFormat: "wav",
    Data: audioBase64, DataLen: Buffer.from(audioBase64, "base64").length,
  });
  return { text: resp.Result ?? "" };
}
