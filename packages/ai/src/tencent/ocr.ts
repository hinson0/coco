export interface TencentOcrOptions {
  readonly secretId: string;
  readonly secretKey: string;
  readonly timeoutMs?: number;
}

export interface OcrResult {
  readonly text: string;
  readonly items: readonly OcrItem[];
}

export interface OcrItem {
  readonly name: string;
  readonly value: string;
}

export async function recognizeReceipt(imageBase64: string, options: TencentOcrOptions): Promise<OcrResult> {
  const tencentcloud = await import("tencentcloud-sdk-nodejs");
  const OcrClient = tencentcloud.ocr.v20181119.Client;
  const client = new OcrClient({ credential: { secretId: options.secretId, secretKey: options.secretKey }, region: "ap-guangzhou" });
  const resp = await client.GeneralBasicOCR({ ImageBase64: imageBase64 });
  const items: OcrItem[] = (resp.TextDetections ?? []).map((det: any) => ({ name: "text", value: det.DetectedText ?? "" }));
  const text = items.map((i) => i.value).join("\n");
  return { text, items };
}
