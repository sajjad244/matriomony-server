require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');
const { ObjectId } = require('mongodb');



// middleware
app.use(cors());
app.use(express.json());

// mongodb connection ___ [--_]

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jdvna.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {

        // making collections of mongodb
        const db = client.db("matrimony_DB");
        const userCollection = db.collection("user"); // for user collection
        // making collections of mongodb


        // ? making api for user collection if user is already exist or not and also if not exist then make new user

        app.post('/users', async (req, res) => {

            const user = req.body;
            const query = { email: user.email };
            //  check if user is already exist or not
            const isExist = await userCollection.findOne(query);
            if (isExist) {
                return res.send({ message: "user already exist", insertedId: null })
            }
            const result = await userCollection.insertOne({ ...user, role: "customer" });
            res.send(result);
        })







        // ! need to delete

        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


// mongodb connection ___ [--_]



// for run the server
app.get('/', (req, res) => {
    res.send('Couple is falling from the sky !!!')
})

app.listen(port, () => {
    console.log(`couple is in love ${port}`)
})


