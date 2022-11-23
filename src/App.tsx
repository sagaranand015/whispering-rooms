import React, { useState, useEffect, useMemo, useCallback } from 'react';
import logo from './logo.svg';
import './App.css';

import { evmFactories, ethereumWalletFactory, EVMNetwork, EVM_NAMES } from '@ylide/ethereum';
import { AbstractBlockchainController, AbstractWalletController, BrowserLocalStorage, MessageContentV3, MessagesList, PublicKey, WalletControllerFactory, Ylide, YlideKeyPair, YlideKeyStore } from '@ylide/sdk';
import {
  everscaleBlockchainFactory,
  everscaleWalletFactory,
  uint256ToAddress,
} from "@ylide/everscale";

// Ylide.registerBlockchainFactory(evmFactories[EVMNetwork.POLYGON]);
// Ylide.registerBlockchainFactory(evmFactories[EVMNetwork.ETHEREUM]);
// Ylide.registerBlockchainFactory(evmFactories[EVMNetwork.BNBCHAIN]);
// Ylide.registerBlockchainFactory(evmFactories[EVMNetwork.POLYGON]);
Ylide.registerBlockchainFactory(evmFactories[EVMNetwork.ARBITRUM]);
// Ylide.registerBlockchainFactory(evmFactories[EVMNetwork.OPTIMISM]);
// Ylide.registerBlockchainFactory(evmFactories[EVMNetwork.AVALANCHE]);
Ylide.registerWalletFactory(ethereumWalletFactory);
// Ylide.registerWalletFactory(everscaleWalletFactory);

function App() {

  const [currentAccount, setCurrentAccount] = useState(null);

  // const { messages: inboxMessages, list: inbox } = useListHandler();
  // // @ts-ignore
  // window.inbox = inbox;
  // const { messages: sentMessages, list: sent } = useListHandler();

  const storage = useMemo(() => new BrowserLocalStorage(), []);
  const keystore = useMemo(
    () =>
      new YlideKeyStore(storage, {
        onPasswordRequest: async () => null,
        onDeriveRequest: async () => null,
      }),
    [storage]
  );

  const [ylide, setYlide] = useState<Ylide | null>(null);
  const [walletsList, setWalletsList] = useState<
    { factory: WalletControllerFactory; isAvailable: boolean }[]
  >([]);
  const [accounts, setAccounts] = useState<
    { wallet: string; address: string }[]
  >(
    localStorage.getItem("accs")
      ? JSON.parse(localStorage.getItem("accs")!)
      : []
  );

  useEffect(() => {
    localStorage.setItem("accs", JSON.stringify(accounts));
  }, [accounts]);
  const [accountsState, setAccountsState] = useState<
    Record<
      string,
      {
        localKey: YlideKeyPair | null;
        remoteKey: Uint8Array | null;
        wallet: {
          wallet: AbstractWalletController;
          factory: WalletControllerFactory;
        } | null;
      }
    >
  >({});
  const [wallets, setWallets] = useState<
    { wallet: AbstractWalletController; factory: WalletControllerFactory }[]
  >([]);
  const [readers, setReaders] = useState<AbstractBlockchainController[]>([]);

  // const [sender, setSender] = useState<EthereumWalletController | null>(null);
  // const [reader, setReader] = useState<EthereumBlockchainController | null>(
  //     null
  // );
  const [keys, setKeys] = useState<YlideKeyStore["keys"]>([]);

  const [from, setFrom] = useState<string | null>(null);
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");

  useEffect(() => {
    if (!ylide) {
      return;
    }
    (async () => {
      const availableWallets = await Ylide.getAvailableWallets();
      setWallets(
        await Promise.all(
          availableWallets.map(async (w) => {
            return {
              factory: w,
              wallet: await ylide.addWallet(
                w.blockchainGroup,
                w.wallet,
                {
                  dev: false, //true,
                  onNetworkSwitchRequest: async (
                    reason: string,
                    currentNetwork: EVMNetwork | undefined,
                    needNetwork: EVMNetwork,
                    needChainId: number
                  ) => {
                    alert(
                      "Wrong network (" +
                      (currentNetwork
                        ? EVM_NAMES[currentNetwork]
                        : "undefined") +
                      "), switch to " +
                      EVM_NAMES[needNetwork]
                    );
                  },
                }
              ),
            };
          })
        )
      );
    })();
  }, [ylide]);

  useEffect(() => {
    if (!wallets.length) {
      return;
    }
    (async () => {
      const result: Record<
        string,
        {
          wallet: {
            wallet: AbstractWalletController;
            factory: WalletControllerFactory;
          } | null;
          localKey: YlideKeyPair | null;
          remoteKey: Uint8Array | null;
        }
      > = {};
      for (let acc of accounts) {
        const wallet = wallets.find(
          (w) => w.factory.wallet === acc.wallet
        );
        result[acc.address] = {
          wallet: wallet || null,
          localKey:
            keys.find((k) => k.address === acc.address)?.keypair ||
            null,
          remoteKey:
            (
              await Promise.all(
                readers.map(async (r) => {
                  if (!r.isAddressValid(acc.address)) {
                    return null;
                  }
                  const c =
                    await r.extractPublicKeyFromAddress(
                      acc.address
                    );
                  if (c) {
                    console.log(
                      `found public key for ${acc.address} in `,
                      r
                    );
                    return c.bytes;
                  } else {
                    return null;
                  }
                })
              )
            ).find((t) => !!t) || null,
        };
      }
      console.log("========= setting account state: ", result);
      setAccountsState(result);
    })();
  }, [accounts, keys, readers, wallets]);

  const handlePasswordRequest = useCallback(async (reason: string) => {
    return prompt(`Enter Ylide password for ${reason}`);
  }, []);

  const handleDeriveRequest = useCallback(
    async (
      reason: string,
      blockchain: string,
      wallet: string,
      address: string,
      magicString: string
    ) => {
      const state = accountsState[address];
      if (!state) {
        return null;
      }
      try {
        return state.wallet!.wallet.signMagicString(
          { address, blockchain, publicKey: null },
          magicString
        );
      } catch (err) {
        return null;
      }
    },
    [accountsState]
  );

  useEffect(() => {
    keystore.options.onPasswordRequest = handlePasswordRequest;
    keystore.options.onDeriveRequest = handleDeriveRequest;
  }, [handlePasswordRequest, handleDeriveRequest, keystore]);

  useEffect(() => {
    (async () => {
      await keystore.init();

      const _ylide = new Ylide(keystore);
      const _readers = [
        // await _ylide.addBlockchain("everscale", {
        //   dev: false, //true,
        // }),
        // await _ylide.addBlockchain("ETHEREUM"),
        // await _ylide.addBlockchain("BNBCHAIN"),
        // await _ylide.addBlockchain("POLYGON"),
        await _ylide.addBlockchain("ARBITRUM"),
        // await _ylide.addBlockchain("OPTIMISM"),
        // await _ylide.addBlockchain("AVALANCHE"),
      ];

      setYlide(_ylide);
      setReaders(_readers);
      setKeys([...keystore.keys]);
    })();
  }, [keystore]);

  useEffect(() => {
    (async () => {
      const list = Ylide.walletsList;
      const result: {
        factory: WalletControllerFactory;
        isAvailable: boolean;
      }[] = [];
      for (const { factory } of list) {
        result.push({
          factory,
          isAvailable: await factory.isWalletAvailable(),
        });
      }
      setWalletsList(result);
    })();
  }, []);

  async function seeWalletList() {
    console.log("======== wallet list is: ", walletsList);
  }

  async function addAccount(factory: WalletControllerFactory) {
    const tempWallet = await factory.create({
      onNetworkSwitchRequest: () => { },
    });
    const newAcc = await tempWallet.requestAuthentication();
    if (!newAcc) {
      alert("Auth was rejected");
      return;
    }
    const exists = accounts.some((a) => a.address === newAcc.address);
    if (exists) {
      alert("Already registered");
      return;
    }
    setAccounts(
      accounts.concat([
        {
          wallet: factory.wallet,
          address: newAcc.address,
        },
      ])
    );
  }

  async function getAddedAccounts() {
    console.log("=========== added accounts are: ", accounts);
  }

  async function generateKey(wallet: string, address: string) {
    const account = accountsState[address];
    const password = await keystore.options.onPasswordRequest(
      `Generation key for ${address}`
    );
    if (!password) {
      return;
    }

    console.log("======== accountState is: ", accountsState, accountsState[address], address);
    console.log("========= generateKey: ", wallet, address, password, account.wallet!.factory.blockchainGroup);

    const k = await keystore.create(
      `Generation key for ${address}`,
      account.wallet!.factory.blockchainGroup,
      wallet,
      address,
      password
    );

    // Switch key storage mode to decrypted
    await k.storeUnencrypted(password);
    // Save the key in the storage again
    await keystore.save();
    // document.location.reload();

    // console.log("========= state is: ", state);

  }

  const publishKey = useCallback(
    async (wallet: string, address: string) => {
      const account = accountsState[address];
      const k = account.localKey?.publicKey;
      if (k) {
        account.wallet!.wallet.attachPublicKey(
          { address, blockchain: "", publicKey: null },
          k,
          {
            address,
            network: EVMNetwork.ARBITRUM,
          }
        );
      } else {
        console.log("======== localKey?.publicKey not there!");
      }

    },
    [accountsState]
  );

  const sendMessage = useCallback(async (fromAcc: string, toAcc: string, subject: string, textBody: string) => {
    if (!ylide) {
      console.log("======= 1!")
      return;
    }
    // const fromAccount = accounts.find((a) => a.address === from);
    if (!fromAcc) {
      console.log("======= 2!")
      return;
    }
    const state = accountsState[fromAcc];
    if (!state) {
      console.log("======= 3!")
      return;
    }
    const content = MessageContentV3.plain(subject, textBody);
    const msgId = await ylide.sendMessage(
      {
        wallet: state.wallet!.wallet,
        sender: (await state.wallet!.wallet.getAuthenticatedAccount())!,
        content,
        recipients: [toAcc],
      },
      { network: EVMNetwork.ARBITRUM }
    );
    alert(`Sent ${msgId}`);
    console.log("======== message has been sent", msgId);
  }, [accounts, accountsState, from, recipient, subject, text, ylide]);

  async function ReadMessage(addr: string) {
    console.log("======= all readers are: ", readers);
    const r = readers[0];
    console.log("========= reader is: ", r);
    const account = accountsState[addr];

    // var msgList = new MessagesList();
    // const msgList = useMemo(() => new MessagesList(), []);
    // msgList.

    var addrUnit256 = account.wallet?.wallet.addressToUint256(addr) || null;
    console.log("======== account (addrUnit256) is: ", addrUnit256);
    console.log("======== account is: ", account);
    // const m = r.retrieveMessageHistoryByTime
    const a = r.addressToUint256(addr);
    // const messages = await r.retrieveMessageHistoryByBounds(addr, a).then(function (resp) {
    //   console.log("========= messages are[1]: ", resp);
    // });
    const messages = await r.retrieveMessageHistoryByBounds(addr, a);
    console.log("========= messages are[2]: ", messages);
    // await r.retrieveBroadcastHistoryByBounds(addrUnit256).then(function (resp) {
    //   console.log("========= messages are: ", resp);
    // });


    const message = messages[1];
    const content = await r.retrieveAndVerifyMessageContent(message);
    if (!content || content.corrupted) { // check content integrity
      throw new Error('Content not found or corrupted');
    }
    console.log("content is: ", content);

    console.log("======== keystore keys are: ", keystore.get(message.recipientAddress));

    const pubKey = account.localKey?.publicKey;
    if (pubKey) {
      const decodedContent = await ylide?.decryptMessageContent(
        {
          address: addr || "",
          blockchain: "evm",
          publicKey: PublicKey.fromPackedBytes(pubKey),
        }, // recipient account
        message, // message header
        content, // message content
      );
      console.log("======== decoded content is: ", decodedContent);
    } else {
      console.log("========= no public key!");
    }



  }

  return (
    <div className="App">
      <header className="App-header">
        <button onClick={seeWalletList}>See Wallet List</button>
        <button onClick={() => addAccount(walletsList[0].factory)}>Add Metamask Account</button>
        <button onClick={getAddedAccounts}>See Added Accounts</button>
        <button onClick={() => generateKey(accounts[0].wallet, "0x9a9b3fbb7c83d82e7cf696d6f2ecca35ba00c356")}>Generate Key for 1st account</button>
        <button onClick={() => publishKey(accounts[0].wallet, "0x9a9b3fbb7c83d82e7cf696d6f2ecca35ba00c356")}>Publish Key for 1st account</button>
        <button onClick={() => sendMessage("0x0a055ed28e6acc2f2377ed0ae3be06d24885d449", "0x9a9b3fbb7c83d82e7cf696d6f2ecca35ba00c356", "Hello World from my app", "Body of the hello world demo message from DevAccount03 To ProdAccount")}>Send Message from 449 to 356</button>
        <button onClick={() => ReadMessage("0x9a9b3fbb7c83d82e7cf696d6f2ecca35ba00c356")}>Read Message Metadata for 356</button>
        {/* <button onClick={checkIfWalletAvailable}>Check Wallet Available</button>
        <button onClick={GetWalletList}>See Wallet List</button>
        <button onClick={initializeKeyStore}>Initialize Keystore</button> */}

      </header>
    </div>
  );
}

export default App;
