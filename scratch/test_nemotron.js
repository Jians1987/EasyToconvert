import fs from "fs";

async function testNemotron() {
    const apiKey = "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";
    
    // Base64 of a simple table with "Name, Age \n Alice, 30 \n Bob, 25"
    // I will generate this base64 using canvas
    
    const b64 = "iVBORw0KGgoAAAANSUhEUgAAAJYAAABQCAIAAAACvS1PAAAABmJLR0QA/wD/AP+gvaeTAAABMUlEQVR4nO3WMQ3AMAwEwX668aX/P8eGBnABK7yP7p2Zufb9n+v/H2D5sDxhWTQsT1gWDcsTlkXD8oRl0bA8YVk0LE9YFg3LE5ZFw/KEZdGwPGFZNCxPWBYNyxOWRcPyhGXRsDxhWTQsT1gWDcsTlkXD8oRl0bA8YVk0LE9YFg3LE5ZFw/KEZdGwPGFZNCxPWBYNyxOWRcPyhGXRsDxhWTQsT1gWDcsTlkXD8oRl0bA8YVk0LE9YFg3LE5ZFw/KEZdGwPGFZNCxPWBYNyxOWRcPyhGXRsDxhWTQsT1gWDcsTlkXD8oRl0bA8YVk0LE9YFg3LE5ZFw/KEZdGwPGFZNCxPWBYNyxOWRcPyhGXRsDxhWTQsT1gWDcsTlkXD8oRl0bA8YVk0LE9YFg3LE5ZFw/IErXICGkM0YtEAAAAASUVORK5CYII=";
    
    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify({
            model: "nvidia/nemotron-parse",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "image_url", image_url: { url: `data:image/png;base64,${b64}` } }
                    ]
                }
            ]
        })
    });
    
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

testNemotron().catch(console.error);
