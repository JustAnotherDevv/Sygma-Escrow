import dotenv from "dotenv";
import {
  EVMGenericMessageTransfer,
  Environment,
  getTransferStatusData,
} from "@buildwithsygma/sygma-sdk-core";
import { BigNumber, Wallet, providers, utils } from "ethers";
import { Storage__factory } from "./Contracts";

dotenv.config();

const privateKey = process.env.PRIVATE_KEY;

if (!privateKey) {
  throw new Error("Missing environment variable: PRIVATE_KEY");
}

const getStatus = async (
  txHash: string
): Promise<{ status: string; explorerUrl: string } | void> => {
  try {
    const data = await getTransferStatusData(Environment.TESTNET, txHash);

    return data as { status: string; explorerUrl: string };
  } catch (e) {
    console.log("error: ", e);
  }
};

const DESTINATION_CHAIN_ID = 5; // Goerli
const RESOURCE_ID =
  "0x0000000000000000000000000000000000000000000000000000000000000500"; // Generic Message Handler
const EXECUTE_CONTRACT_ADDRESS = "0x3cc0D6b99f53C07724C8d43E17A859F519a29Db8";//"0x3cc0D6b99f53C07724C8d43E17A859F519a29Db8";//"0xdFA5621F95675D37248bAc9e536Aab4D86766663";
const EXECUTE_FUNCTION_SIGNATURE = "0x845c03c1"//"0x151c3b12";//"0xa271ced2";
const MAX_FEE = "60000000";
const sourceProvider = new providers.JsonRpcProvider(
  // "https://gateway.tenderly.co/public/sepolia"
  "https://sepolia.infura.io/v3/ce5f76e964a04398b96248661948afc6"
);
const destinationProvider = new providers.JsonRpcProvider(
  // "https://rpc.goerli.eth.gateway.fm/"
  "https://goerli.infura.io/v3/ce5f76e964a04398b96248661948afc6"
);
const storageContract = Storage__factory.connect(
  EXECUTE_CONTRACT_ADDRESS,
  destinationProvider
);
const wallet = new Wallet(privateKey ?? "", sourceProvider);

const fetchAfterValue = async (): Promise<BigNumber> =>
  await storageContract.retrieve(await wallet.getAddress());

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

const waitUntilBridged = async (
  valueBefore: BigNumber,
  intervalDuration: number = 15000,
  attempts: number = 16//8
): Promise<void> => {
  let i = 0;
  let contractValueAfter: BigNumber;
  for (;;) {
    await sleep(intervalDuration);
    contractValueAfter = await fetchAfterValue();
    if (!contractValueAfter.eq(valueBefore)) {
      console.log("Transaction successfully bridged.");
      // console.log(
      //   `Value after update: ${new Date(
      //     contractValueAfter.toNumber()
      //   ).toString()}`
      // );
      console.log(
        `Value after update: ${
          contractValueAfter.toString()}`
      );
      break;
    }
    i++;
    if (i > attempts) {
      // transaction should have been bridged already
      console.log("transaction is taking too much time to bridge!");
      break;
    }
  }
};

export async function genericMessage(): Promise<void> {


  const contractValueBefore = await storageContract.retrieve(
    await wallet.getAddress()
  );
  // console.log(
  //   `Value before update: ${new Date(
  //     contractValueBefore.toNumber()
  //   ).toString()}`
  // );
  // console.log(utils.toUtf8Bytes("Bingus"))
  console.log(
    `Value before update: `, contractValueBefore
  );
  // console.log(`value: `, utils.toUtf8String(utils.arrayify(contractValueBefore)))

  // return;
  
  const messageTransfer = new EVMGenericMessageTransfer();
  await messageTransfer.init(sourceProvider, Environment.TESTNET);

  const BRIDGED_MSG = "Bingus";
  // const EXECUTION_DATA = utils.defaultAbiCoder.encode(["uint"], [Date.now()]);
  // const EXECUTION_DATA = utils.defaultAbiCoder.encode(["bytes"], [utils.toUtf8Bytes(BRIDGED_MSG)]);
  // const EXECUTION_DATA = utils.defaultAbiCoder.encode(["string memory"], [utils.toUtf8String(utils.arrayify(BRIDGED_MSG))]);
  // const EXECUTION_DATA = Storage__factory.createInterface().encodeFunctionData("store", [ "0x24BE76DFa8f4b549d1Cb07b3f5d9804e633F2293", "bingus" ])
  const EXECUTION_DATA = utils.defaultAbiCoder.encode(["address depositor", "string memory val"], ["0x24BE76DFa8f4b549d1Cb07b3f5d9804e633F2293", "test"]);

  console.log(EXECUTION_DATA)
  // return;

  const transfer = messageTransfer.createGenericMessageTransfer(
    await wallet.getAddress(),
    DESTINATION_CHAIN_ID,
    RESOURCE_ID,
    EXECUTE_CONTRACT_ADDRESS,
    EXECUTE_FUNCTION_SIGNATURE,
    EXECUTION_DATA,
    MAX_FEE
  );

  const fee = await messageTransfer.getFee(transfer);
  const transferTx = await messageTransfer.buildTransferTransaction(
    transfer,
    fee
  );

  const response = await wallet.sendTransaction(
    transferTx as providers.TransactionRequest
  );
  console.log("Sent transfer with hash: ", response.hash);

  console.log("Waiting for relayers to bridge transaction...");

  await waitUntilBridged(contractValueBefore);

  let dataResponse: undefined | { status: string; explorerUrl: string };

  const id = setInterval(() => {
    getStatus(response.hash)
      .then((data) => {
        if (data) {
          dataResponse = data;
          console.log("Status of the transfer", data.status);
        }
      })
      .catch(() => {
        console.log("Transfer still not indexed, retrying...");
      });

    if (dataResponse && dataResponse.status === "executed") {
      console.log("Transfer executed successfully");
      clearInterval(id);
      process.exit(0);
    }
  }, 5000);
}

genericMessage().finally(() => {});
