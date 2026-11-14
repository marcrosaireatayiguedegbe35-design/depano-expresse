import { Global, Module } from '@nestjs/common';
import { MongooseModule, InjectModel } from '@nestjs/mongoose';
import { config } from './config';
import { MODELS, ModelName } from './models';

const features = MongooseModule.forFeature(
  (Object.keys(MODELS) as ModelName[]).map((name) => ({ name, schema: MODELS[name] })),
);

@Global()
@Module({
  imports: [
    MongooseModule.forRoot(config.mongoUri, { dbName: config.mongoDb, autoIndex: true }),
    features,
  ],
  exports: [features],
})
export class DatabaseModule {}

/** Injection typée d'un modèle du registre. */
export const InjectM = (name: ModelName) => InjectModel(name);
