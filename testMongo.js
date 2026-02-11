const { MongoClient, ServerApiVersion } = require("mongodb");

const uri = "mongodb+srv://chatuser:01012026@cluster0.pbpuhuq.mongodb.net/chatdb?retryWrites=true&w=majority";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("✅ KẾT NỐI ATLAS THÀNH CÔNG!");
  } catch (err) {
    console.error("❌ KẾT NỐI THẤT BẠI:", err.message);
  } finally {
    await client.close();
  }
}

run();
