import { z } from "zod";

export default z
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
  .strict();
