import { z } from "zod";
import { getLive, getStash } from "@zipchat/database";

const stash = getStash();
const live = getLive();

async function pick() {
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
  if (!chat) throw new Error("No chat found");
  // planetscale has a transaction timeout of 20 seconds
  const { id } = await live.chat.create({
    data: {
      title: chat.title,
      isStillParticipant: chat.isStillParticipant,
      threadPath: chat.threadPath,
      participants: {
        create: chat.participants.map((p) => ({
          name: p.name,
        })),
      },
      magicWords: {
        create: chat.magicWords.map((m) => ({
          word: m.word,
        })),
      },
      joinableMode: {
        create: {
          mode: chat.joinableMode.mode,
          link: chat.joinableMode.link,
        },
      },
      image: {
        create: {
          uri: chat.image.uri,
          creationTimestamp: chat.image.creationTimestamp,
        },
      },
    },
  });
  for (const message of topMessages) {
    await live.message.create({
      data: {
        Chat: { connect: { id } },
        sender: {
          connectOrCreate: {
            where: {
              name: message.senderName,
            },
            create: {
              name: message.senderName,
            },
          },
        },
        timestampMs: String(message.timestampMs),
        content: message.content,
        photos: {
          create: message.photos?.map((p) => ({
            uri: p.uri,
            creationTimestamp: p.creationTimestamp,
          })),
        },
        videos: {
          create: message.videos?.map((v) => ({
            uri: v.uri,
            creationTimestamp: v.creationTimestamp,
          })),
        },
        gifs: {
          create: message.gifs?.map((g) => ({
            uri: g.uri,
          })),
        },
        files: {
          create: message.files?.map((f) => ({
            uri: f.uri,
            creationTimestamp: f.creationTimestamp,
          })),
        },
        audioFiles: {
          create: message.audioFiles?.map((a) => ({
            uri: a.uri,
            creationTimestamp: a.creationTimestamp,
          })),
        },
        ...(message.sticker && {
          sticker: {
            create: {
              uri: message.sticker?.uri,
            },
          },
        }),
        callDuration: message.callDuration,
        ...(message.share && {
          share: {
            create: {
              link: message.share?.link,
              shareText: message.share?.shareText,
            },
          },
        }),
        isUnsent: message.isUnsent,
        users: {
          connectOrCreate: message.users?.map((u) => ({
            where: {
              name: u.name,
            },
            create: {
              name: u.name,
            },
          })),
        },
        reactions: {
          create: message.reactions?.map((r) => ({
            reaction: r.reaction,
            actor: {
              connectOrCreate: {
                where: {
                  name: r.actorName,
                },
                create: {
                  name: r.actorName,
                },
              },
            },
          })),
        },
      },
    });
  }
}

async function post() {
  const messages = await live.message.findMany({ select: { id: true } });
  for (const { id } of messages) {
    await live.post.create({
      data: { message: { connect: { id } }, isVisible: true },
    });
  }
}

post()
  .then(async () => {
    await stash.$disconnect();
    await live.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await stash.$disconnect();
    await live.$disconnect();
    process.exit(1);
  });
