import { getStash } from "@zipchat/database";
import { z } from "zod";

const stash = getStash();

async function main() {
  const topIdsSchema = z.array(z.object({ id: z.string().cuid() }).strict());
  const topIds = topIdsSchema.parse(
    await stash.$queryRaw`
      SELECT id
      FROM Message
      INNER JOIN (
        SELECT messageId, COUNT(*) as reaction_count
        FROM Reaction
        GROUP BY messageId
        HAVING reaction_count >= 10
      ) r ON Message.id = r.messageId;
    `
  );
  const topMessages = await stash.message.findMany({
    where: {
      id: {
        in: topIds.map((id) => id.id),
      },
    },
    include: {
      sender: true,
      reactions: true,
      photos: true,
      videos: true,
      gifs: true,
      files: true,
      audioFiles: true,
      share: true,
      sticker: true,
      users: true,
    },
  });
  const chat = await stash.chat.findFirst({
    include: {
      joinableMode: true,
      image: true,
      magicWords: true,
      participants: true,
    },
  });
  console.log(chat);
  console.log(topMessages);
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
