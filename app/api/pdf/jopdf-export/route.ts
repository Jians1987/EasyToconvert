import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const format = formData.get("format") as string || "docx";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Prepare temp files
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const tempDir = os.tmpdir();
    const inputPath = path.join(tempDir, `jopdf_input_${Date.now()}.pdf`);
    const outputPath = path.join(tempDir, `jopdf_output_${Date.now()}.${format}`);

    fs.writeFileSync(inputPath, buffer);

    // Call JOPDF.exe (Assuming it takes standard input/output arguments)
    // Note: If JOPDF does not support CLI, this will likely hang or fail.
    const jopdfPath = `"C:\\Program Files\\JOPDF\\JOPDF.exe"`;
    
    // We try a common syntax: JOPDF.exe -i input.pdf -o output.ext
    const command = `${jopdfPath} -i "${inputPath}" -o "${outputPath}"`;
    
    try {
      await execAsync(command, { timeout: 30000 }); // 30 second timeout
    } catch (cmdErr: any) {
      console.error("JOPDF Execution Error:", cmdErr);
      
      // Clean up input
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      
      return NextResponse.json({ 
        error: "JOPDF execution failed or timed out. Ensure the software supports headless command-line execution.",
        details: cmdErr.message
      }, { status: 500 });
    }

    if (!fs.existsSync(outputPath)) {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      return NextResponse.json({ error: "JOPDF did not generate an output file." }, { status: 500 });
    }

    const outputBuffer = fs.readFileSync(outputPath);
    
    // Clean up
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

    // Return the generated file
    return new NextResponse(outputBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="jopdf_converted.${format}"`,
      },
    });
  } catch (error: any) {
    console.error("JOPDF route error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
