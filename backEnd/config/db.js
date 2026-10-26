import mongoose from "mongoose";
export default async function connectDB() {
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.MONGO_DATABASE,
    autoIndex: process.env.NODE_ENV !== "production",
    serverSelectionTimeoutMS: 10000,
  });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== "isdbgrid")
    throw new Error(
      "OrganSync requires a MongoDB replica set or sharded cluster for transactional workflows",
    );
  if(process.env.NODE_ENV === "production"){
    for(const model of Object.values(mongoose.models)){
      const required=model.schema.indexes().filter(([,options])=>options.unique);
      if(!required.length)continue;
      const actual=await model.collection.indexes();
      for(const [key,options] of required)if(!actual.some(index=>index.unique && JSON.stringify(index.key)===JSON.stringify(key) && JSON.stringify(index.partialFilterExpression||null)===JSON.stringify(options.partialFilterExpression||null)))throw new Error(`Required index missing on ${model.modelName}; run the documented migration/index checks before startup`);
    }
  }
  console.log("MongoDB connected");
}
