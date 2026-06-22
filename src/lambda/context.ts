import { AppModule } from "@/app.module";

import { NestFactory } from "@nestjs/core";
import { INestApplicationContext } from "@nestjs/common";

let appContext: INestApplicationContext | null = null;

export async function getAppContext(): Promise<INestApplicationContext> {
  if (!appContext) {
    appContext = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
    });
  }

  return appContext;
}
