import { corsHeaders } from "../_shared/cors.ts";

const TENCENT_SECRET_ID = Deno.env.get("TENCENT_SECRET_ID")!;
const TENCENT_SECRET_KEY = Deno.env.get("TENCENT_SECRET_KEY")!;

// ─── 腾讯云 ASR（纯语音转文字） ───
async function recognizeSpeech(audioBase64: string): Promise<string> {
  const tencentcloud = await import("npm:tencentcloud-sdk-nodejs@4");
  const AsrClient = tencentcloud.asr.v20190614.Client;
  const client = new AsrClient({
    credential: { secretId: TENCENT_SECRET_ID, secretKey: TENCENT_SECRET_KEY },
    region: "ap-guangzhou",
  });
  const resp = await client.SentenceRecognition({
    EngSerViceType: "16k_zh",
    SourceType: 1,
    VoiceFormat: "m4a",
    Data: audioBase64,
    DataLen: new Uint8Array(atob(audioBase64).split("").map((c) => c.charCodeAt(0))).length,
  });
  return resp.Result ?? "";
}

// ─── Handler ───
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { audioBase64 } = await req.json();
    if (!audioBase64) {
      return new Response(JSON.stringify({ error: "Missing audioBase64" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const asrText = await recognizeSpeech(audioBase64);

    return new Response(JSON.stringify({ data: { asrText } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("record-asr error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
