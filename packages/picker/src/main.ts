import { getStash } from "@zipchat/database";

const stash = getStash();

async function main() {
  const chats = await stash.chat.findMany();
  console.log(chats);
}

main()
  .then(async () => {
    await stash.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await stash.$disconnect();
    process.exit(1);
  });
