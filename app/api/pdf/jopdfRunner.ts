import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

const execAsync = promisify(exec);

const DEFAULT_SECRET = "6SxpFwYHcPrvdEvH8TGr";

function resolveJopdfEnvironment() {
  const customJava = process.env.JOPDF_JAVA_EXE;
  const customClasspath = process.env.JOPDF_CLASSPATH;
  const secret = process.env.JOPDF_SECRET || DEFAULT_SECRET;

  let javaExe = customJava;
  let classpath = customClasspath;

  if (!javaExe || !classpath) {
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    const defaultToolDir = path.join(appData, "JOPDF", "tools", "pdf_tool");
    const defaultJava = path.join(defaultToolDir, "jdk-17_x64", "bin", "java.exe");
    const defaultCp = `${path.join(defaultToolDir, "*")};`;

    if (!javaExe) {
      javaExe = fsSync.existsSync(defaultJava) ? `"${defaultJava}"` : "java";
    } else if (!javaExe.startsWith('"') && javaExe.includes(" ")) {
      javaExe = `"${javaExe}"`;
    }

    if (!classpath) {
      classpath = `"${defaultCp}"`;
    } else if (!classpath.startsWith('"') && classpath.includes(" ")) {
      classpath = `"${classpath}"`;
    }
  }

  return { javaExe, classpath, secret };
}

function getSignString(outputPath: string, secret: string): string {
  const hash = crypto.createHash("md5");
  hash.update(secret + outputPath + secret);
  return hash.digest("hex");
}

export interface JopdfTaskOptions {
  file: File;
  inputExt: string;
  outputExt: string;
  jopdfMode: string;
  jopdfOptions: string;
}

export async function runJopdfTask(options: JopdfTaskOptions): Promise<Buffer> {
  const { file, inputExt, outputExt, jopdfMode, jopdfOptions } = options;
  const { javaExe, classpath, secret } = resolveJopdfEnvironment();

  const tmpDir = os.tmpdir();
  const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const tmpInputPath = path.join(tmpDir, `${uniquePrefix}_input.${inputExt}`);
  const tmpOutputPath = path.join(tmpDir, `${uniquePrefix}_output.${outputExt}`);

  try {
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(tmpInputPath, Buffer.from(arrayBuffer));

    const b64Input = Buffer.from(tmpInputPath).toString("base64");
    const b64Output = Buffer.from(tmpOutputPath).toString("base64");
    const sign = getSignString(b64Output, secret);

    const cmd = `${javaExe} -cp ${classpath} Main -convert ${jopdfMode} -options "${jopdfOptions}" -i ${b64Input} -o ${b64Output} -sign ${sign}`;

    const { stdout, stderr } = await execAsync(cmd, {
      timeout: 45000,
      maxBuffer: 10 * 1024 * 1024,
    });

    if (!stdout.includes("isOK: true")) {
      console.error("JOPDF Execution Failed:", stdout, stderr);
      throw new Error(`JOPDF conversion failed: ${stderr || stdout || "Unknown error"}`);
    }

    const outputExists = fsSync.existsSync(tmpOutputPath);
    if (!outputExists) {
      throw new Error("JOPDF conversion completed but output file was not found.");
    }

    return await fs.readFile(tmpOutputPath);
  } catch (err: any) {
    if (err.code === "ETIMEDOUT") {
      throw new Error("JOPDF processing timed out after 45 seconds.");
    }
    throw err;
  } finally {
    await fs.unlink(tmpInputPath).catch(() => {});
    await fs.unlink(tmpOutputPath).catch(() => {});
  }
}
