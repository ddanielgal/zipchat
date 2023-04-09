import { SupabaseClient, createClient } from "@supabase/supabase-js";
import { getLive } from "@zipchat/database";
import Harvester from "@zipchat/harvester";

const db = getLive();

class FileBridge {
  private harvester: Harvester;
  private supabase: SupabaseClient;

  constructor() {
    this.harvester = new Harvester();
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
  }

  async brige() {
    const photos = await db.photo.findMany();
    const videos = await db.video.findMany();
    const gifs = await db.gif.findMany();
    const files = await db.file.findMany();
    const audioFiles = await db.audioFile.findMany();
    const stickers = await db.sticker.findMany();
    const media = [
      ...photos,
      ...videos,
      ...gifs,
      ...files,
      ...audioFiles,
      ...stickers,
    ];
    for (const m of media) {
      const buffer = await this.harvester.getFile(m.uri);
      if (!buffer) {
        console.error(`Could not find ${m.uri}`);
        continue;
      }
      const result = await this.supabase.storage
        .from("toplista")
        .upload(m.uri, buffer);
      if (result.error) {
        console.error(`Could not upload ${m.uri}: ${result.error.message}`);
        continue;
      }
      console.log(`Uploaded ${result.data.path}`);
    }
  }
}
async function main() {
  const fileBridge = new FileBridge();
  await fileBridge.brige();
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
