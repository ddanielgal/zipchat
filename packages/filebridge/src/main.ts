import Harvester from "@zipchat/harvester";

class FileBridge {
  private harvester: Harvester;

  constructor() {
    this.harvester = new Harvester();
  }

  async brige() {
    return this.harvester.getFile(
      "messages/inbox/chat/image.png"
    );
  }
}

async function main() {
  const fileBridge = new FileBridge();
  console.log(await fileBridge.brige());
}

main();
