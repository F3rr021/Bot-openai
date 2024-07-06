import { httpInject, toAsk } from "@builderbot-plugins/openai-assistants";
import {
  addKeyword,
  createBot,
  createFlow,
  createProvider,
  MemoryDB as Database,
  EVENTS,
} from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import "dotenv/config";
import { typing } from "./utils/presence";

const PORT = process.env?.PORT ?? 3008;
const ASSISTANT_ID = process.env?.ASSISTANT_ID ?? "";

const welcomeFlow = addKeyword<Provider, Database>(EVENTS.WELCOME).addAction(
  async (ctx, { flowDynamic, state, provider }) => {
    const message = ctx.body;

    const activeDef = {
      "@finalizado@": true,
      agente: false,
    };
    const fromMe = ctx.key.fromMe;

    for (const [key, value] of Object.entries(activeDef)) {
      if (message.toLocaleLowerCase().includes(key)) {
        const filterValue = value === true && fromMe === undefined ? false : value;
        await state.update({ isActive: filterValue });
        
      }
    }
    const isActive = await state.get<boolean>("isActive");
    if (isActive !== undefined && !isActive) {
      return;
    }

    await typing(ctx, provider);
    const response = await toAsk(ASSISTANT_ID, ctx.body, state);
    const chunks = response.split(/\n\n+/);
    for (const chunk of chunks) {
      await flowDynamic([{ body: chunk.trim() }]);
    }
  }
);

const main = async () => {
  const adapterFlow = createFlow([welcomeFlow]);
  const adapterProvider = createProvider(Provider);
  const adapterDB = new Database();

  const bot = await createBot({
    flow: adapterFlow,
    provider: adapterProvider,
    database: adapterDB,
  });

  const { httpServer, provider } = bot;

  provider.on("receive_message", async ({ from, body, name }) => {
    console.log(`Receive Message Payload:`, { body, from, name });
  });

  bot.on("send_message", ({ answer, from }) => {
    console.log(`Send Message Payload:`, { answer, from });
  });

  httpInject(adapterProvider.server);
  httpServer(+PORT);
};

main();
