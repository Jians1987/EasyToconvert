import fs from "fs";

async function run() {
    const apiKey = process.env.NVIDIA_NEMOTRON_API_KEY;
    if (!apiKey) throw new Error("Set NVIDIA_NEMOTRON_API_KEY before running this script.");
    const res = await fetch("https://integrate.api.nvidia.com/v1/models", {
        headers: { "Authorization": `Bearer ${apiKey}` }
    });
    const data = await res.json();
    const models = data.data.map(m => m.id);
    const nemotronModels = models.filter(m => m.includes("nemotron"));
    console.log(nemotronModels);
}
run();
