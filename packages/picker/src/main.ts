import Harvester from "@zipchat/harvester";

async function main() {
  const harvester = new Harvester();
  console.log(await harvester.harvest());
}

main();
