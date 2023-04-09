import * as fs from "fs";
import { z } from "zod";
import { Command } from "@commander-js/extra-typings";
import produce from "immer";
import { Stash, getStash } from "@zipchat/database";

const program = new Command()
  .name("m2d")
  .description("Validate zipchat data and write to database")
  .argument("<file>", "zipchat output file")
  .option(
    "-c, --chat <chatId>",
    "provide ID of chat if chat already exists in db"
  );

program.parse(process.argv);

const rawChat = JSON.parse(
  fs.readFileSync(process.argv[2], { encoding: "utf-8" })
);

const Chat = z.record(
  z
    .object({
      title: z.string(),
      is_still_participant: z.boolean(),
      thread_path: z.string(),
      participants: z.array(z.object({ name: z.string() }).strict()),
      magic_words: z.array(z.string()),
      joinable_mode: z.object({ mode: z.number(), link: z.string() }).strict(),
      image: z
        .object({ uri: z.string(), creation_timestamp: z.number() })
        .strict(),
      messages: z.array(
        z
          .object({
            sender_name: z.string(),
            timestamp_ms: z.number(),
            content: z.string().optional(),
            photos: z
              .array(
                z
                  .object({ uri: z.string(), creation_timestamp: z.number() })
                  .strict()
              )
              .optional(),
            videos: z
              .array(
                z
                  .object({ uri: z.string(), creation_timestamp: z.number() })
                  .strict()
              )
              .optional(),
            gifs: z
              .array(
                z
                  .object({
                    uri: z.string(),
                  })
                  .strict()
              )
              .optional(),
            files: z
              .array(
                z
                  .object({ uri: z.string(), creation_timestamp: z.number() })
                  .strict()
              )
              .optional(),
            audio_files: z
              .array(
                z
                  .object({ uri: z.string(), creation_timestamp: z.number() })
                  .strict()
              )
              .optional(),
            sticker: z.object({ uri: z.string() }).strict().optional(),
            call_duration: z.number().optional(),
            share: z
              .object({
                link: z.string().optional(),
                share_text: z.string().optional(),
              })
              .strict()
              .optional(),
            is_unsent: z.boolean().optional(),
            users: z.array(z.object({ name: z.string() }).strict()).optional(),
            reactions: z
              .array(
                z.object({ reaction: z.string(), actor: z.string() }).strict()
              )
              .optional(),
          })
          .strict()
      ),
    })
    .strict()
);

const chat = Chat.parse(rawChat);

const [firstChat] = Object.values(chat);

const stash = getStash();

async function main() {
  let chatId = program.opts().chat;
  if (!chatId) {
    const { id } = await stash.chat.create({
      data: {
        title: firstChat.title,
        isStillParticipant: firstChat.is_still_participant,
        threadPath: firstChat.thread_path,
        participants: {
          create: firstChat.participants.map((p) => ({
            name: p.name,
          })),
        },
        magicWords: {
          create: firstChat.magic_words.map((m) => ({
            word: m,
          })),
        },
        joinableMode: {
          create: {
            mode: firstChat.joinable_mode.mode,
            link: firstChat.joinable_mode.link,
          },
        },
        image: {
          create: {
            uri: firstChat.image.uri,
            creationTimestamp: firstChat.image.creation_timestamp,
          },
        },
      },
    });
    chatId = id;
  }
  const messages = Object.values(chat).flatMap((ch) => ch.messages);
  const chunkSize = 5000;
  console.log(`${messages.length} messages`);
  for (let i = 0; i < messages.length + chunkSize; i += chunkSize) {
    console.log(`${i} -> ${i + chunkSize}`);
    const queries = messages.slice(i, i + chunkSize).map((m) => ({
      data: {
        Chat: { connect: { id: chatId } },
        sender: {
          connectOrCreate: {
            where: {
              name: m.sender_name,
            },
            create: {
              name: m.sender_name,
            },
          },
        },
        timestampMs: String(m.timestamp_ms),
        content: m.content,
        photos: {
          create: m.photos?.map((p) => ({
            uri: p.uri,
            creationTimestamp: p.creation_timestamp,
          })),
        },
        videos: {
          create: m.videos?.map((v) => ({
            uri: v.uri,
            creationTimestamp: v.creation_timestamp,
          })),
        },
        gifs: {
          create: m.gifs?.map((g) => ({
            uri: g.uri,
          })),
        },
        files: {
          create: m.files?.map((f) => ({
            uri: f.uri,
            creationTimestamp: f.creation_timestamp,
          })),
        },
        audioFiles: {
          create: m.audio_files?.map((a) => ({
            uri: a.uri,
            creationTimestamp: a.creation_timestamp,
          })),
        },
        ...(m.sticker && {
          sticker: {
            create: {
              uri: m.sticker?.uri,
            },
          },
        }),
        callDuration: m.call_duration,
        ...(m.share && {
          share: {
            create: {
              link: m.share?.link,
              shareText: m.share?.share_text,
            },
          },
        }),
        isUnsent: m.is_unsent,
        users: {
          connectOrCreate: m.users?.map((u) => ({
            where: {
              name: u.name,
            },
            create: {
              name: u.name,
            },
          })),
        },
        reactions: {
          create: m.reactions?.map((r) => ({
            reaction: r.reaction,
            actor: {
              connectOrCreate: {
                where: {
                  name: r.actor,
                },
                create: {
                  name: r.actor,
                },
              },
            },
          })),
        },
      },
    }));
    const results = await Promise.allSettled(
      queries.map((query) => stash.message.create(query))
    );
    // Try failed ones again with timestamp+1
    const fails: Stash.MessageCreateArgs[] = [];
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        fails.push(
          produce(queries[index], (draft) => {
            const lastChar = draft.data.timestampMs.slice(-1);
            const newLastChar = String(Number(lastChar) + 1);
            draft.data.timestampMs =
              draft.data.timestampMs.slice(0, -1) + newLastChar;
          })
        );
      }
    });
    await Promise.allSettled(fails.map((query) => stash.message.create(query)));
  }
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
