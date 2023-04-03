import * as fs from "fs";
import StreamZip from "node-stream-zip";
import { z } from "zod";
import iconv from "iconv-lite";
import schema from "./schema";

type MessageFile = {
  zipFilePath: string;
  entryName: string;
};

export default class Harvester {
  files: string[];
  messageFiles: MessageFile[] = [];
  chat: z.infer<typeof schema>;

  constructor() {
    this.files = fs.readdirSync("data");
  }

  async harvest() {
    await this.collectMessageFiles();
    const [first, ...rest] = this.messageFiles;
    const chat = await this.getChatPart(first);
    for (const file of rest) {
      const chatPart = await this.getChatPart(file);
      chat.messages.push(...chatPart.messages);
    }
    return chat.messages.length;
  }

  async getChatPart(file: MessageFile) {
    const rawContent = await new StreamZip.async({
      file: file.zipFilePath,
    }).entryData(file.entryName);
    const firstParsed = JSON.parse(rawContent.toString(), (_, value) => {
      if (typeof value !== "string") return value;
      return iconv.decode(iconv.encode(value, "latin1"), "utf-8");
    });
    const chat = schema.parse(firstParsed);
    return chat;
  }

  async collectMessageFiles() {
    for (const file of this.files) {
      const filePath = `data/${file}`;
      const zip = new StreamZip.async({ file: filePath });
      const entries = await zip.entries();

      this.messageFiles.push(
        ...Object.values(entries)
          .filter((entry) => entry.name.includes(process.argv[2]))
          .filter((entry) => entry.name.endsWith(".json"))
          .map((entry) => ({ zipFilePath: filePath, entryName: entry.name }))
      );
      await zip.close();
    }
    return this.messageFiles;
  }
}
