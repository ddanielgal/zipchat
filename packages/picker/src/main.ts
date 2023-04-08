import { getStash } from "@zipchat/database";
import { z } from "zod";

const stash = getStash();

async function main() {
  const topSchema = z.array(z.object({ id: z.string().cuid() }).strict());
  const top = topSchema.parse(
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
  console.log(top)
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
