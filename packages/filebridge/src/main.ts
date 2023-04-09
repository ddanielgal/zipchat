import { SupabaseClient, createClient } from "@supabase/supabase-js";
import Harvester from "@zipchat/harvester";

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
    const buffer = await this.harvester.getFile(
      "messages/inbox/chat/image.png"
    );
    return await this.supabase.storage
      .from("toplista")
      .upload("messages/inbox/chat/image.png", buffer);
  }
}
async function main() {
  const fileBridge = new FileBridge();
  console.log(await fileBridge.brige());
}

main();
