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
import { Accordion, Button, Card, CardGroup, Col, Row } from 'react-bootstrap';
import { PLATFORM_ADDRESS } from './constants';

import { Navbar, Container, Nav, Dropdown } from "react-bootstrap";
import CardHeader from 'react-bootstrap/esm/CardHeader';
import { IntroPage } from './components/IntroPage';

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

  /*
  [START] STATE VARIABLES FOR STORING ACCOUNTS, WALLETS AND ALL ASSOICATED DATA
   */
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
  const [currAcc, setCurrAcc] = useState<
    { wallet: string; address: string }
  >();
  const [currAccState, setCurrAccState] = useState<
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
  const [keys, setKeys] = useState<YlideKeyStore["keys"]>([]);
  /*
  [END] STATE VARIABLES FOR STORING ACCOUNTS, WALLETS AND ALL ASSOICATED DATA
   */

  const [currRooms, setCurrRooms] = useState<{ roomName: string | null, roomData: JSON, recipients: [] }[]>([]);
  useEffect(() => {
    console.log("========= UPDATED ROOMS ARE: ", currRooms);
  }, [currRooms]);

  /*
  [START] USE EFFECTS FOR INITIALIZING THE STATE VARIABLES ON APP LOAD. 
  WE CAN DO THIS ON USER INTERACTION TOO, ITS JUST BETTER TO MAKE SURE WE INITIALIZE 
  THE APP PROPERLY WHEN WE ALREADY HAVE THE REQUIRED DATA
  */

  // useEffect to set accounts
  useEffect(() => {
    localStorage.setItem("accs", JSON.stringify(accounts));
  }, [accounts, currAcc]);

  // useEffect to set all available wallets and adding those to ylide sdk
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

  // useEffect to setup the account states with associated wallets and local/remote keys.
  // this will register the remoteKey if available from ylide, 
  // otherwise we'll have to ask the user to publish their keys to the selected blockchain
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
  }, [accounts, keys, readers, wallets, currAcc]);

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

  // setting up the ylide SDK, READERS AND KEYS once they're available from above useEffect functions
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

  // useEffect to get the connected wallets in the app state
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
  /*
  [END] USE EFFECTS FOR INITIALIZING THE STATE VARIABLES ON APP LOAD. 
  WE CAN DO THIS ON USER INTERACTION TOO, ITS JUST BETTER TO MAKE SURE WE INITIALIZE 
  THE APP PROPERLY WHEN WE ALREADY HAVE THE REQUIRED DATA
  */

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
      setCurrAcc({
        wallet: factory.wallet,
        address: newAcc.address,
      });
      alert(`Account: ${newAcc.address} is already authenticated and registered in the app state`);
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
    setCurrAcc({
      wallet: factory.wallet,
      address: newAcc.address,
    });
    alert(`Account: ${newAcc.address} has been authenticated and added to the app state. ${currAcc?.address}`);
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

    if (!account || !account.wallet) {
      alert(`Wallet has not been initialized for this address: ${address}`);
      return
    }

    console.log("========= Generating KEY: ", wallet, address, password, account.wallet!.factory.blockchainGroup);
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
    document.location.reload();
    // alert(`done generating key locally for address: ${address}`);
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
        alert("Please generate the key and reload the page to get the local public key in state!");
      }

    },
    [accountsState]
  );

  async function createRoom(roomName: string, creatorAddr: string, recipientAccounts: string[]) {
    if (!ylide) {
      alert("No ylide sdk initialized. Reload the page");
      return;
    }
    const fromAcc = accounts.find((a) => a.address === creatorAddr);
    if (!fromAcc) {
      alert("Specify the room creator...");
      return;
    }
    const state = accountsState[fromAcc.address];
    if (!state) {
      console.log("Room creator does not have state initialized. Do the above operations first to register the creator");
      return;
    }

    const createRoomSubject = `ROOM CREATED:${roomName}`;
    recipientAccounts.push(creatorAddr);
    const createRoomBody = {
      "creator_address": fromAcc,
      "roomName": roomName,
      "recipients": recipientAccounts
    };
    const content = MessageContentV3.plain(createRoomSubject, JSON.stringify(createRoomBody));
    const msgId = await ylide.sendMessage(
      {
        wallet: state.wallet!.wallet,
        sender: (await state.wallet!.wallet.getAuthenticatedAccount())!,
        content,
        recipients: recipientAccounts,
      },
      { network: EVMNetwork.ARBITRUM }
    );
    alert(`Room Created with MessageId: ${msgId}`);
    console.log(`Room Created with MessageId: ${msgId}`);
  }

  async function GetMyRooms(addr: string) {
    const r = readers[0];
    const account = accountsState[addr];
    if (!r || !account) {
      alert("Please reload the page to make sure readers and accounts have been initialized");
      return;
    }
    const a = r.addressToUint256(addr);
    const messages = await r.retrieveMessageHistoryByBounds(addr, a);
    console.log("========= all messages are: ", messages);

    let roomsArr = []
    for (var message of messages) {
      const content = await r.retrieveAndVerifyMessageContent(message);
      if (!content || content.corrupted) { // check content integrity
        throw new Error('Content not found or corrupted');
      }
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
        // console.log("======== decoded content is: ", decodedContent);
        if (decodedContent?.subject.startsWith("ROOM CREATED")) {
          console.log(`got a room: ${decodedContent.subject.split(":")[1]} with data: ${decodedContent.content}`);
          roomsArr.push({
            'roomName': decodedContent.subject.split(":")[1],
            'roomData': JSON.parse(decodedContent.content),
            'recipients': JSON.parse(decodedContent.content)['recipients']
          })
        }
      } else {
        console.log("========= no public key!");
        alert("make sure generate and publish functions have been called and app state is initialized");
      }
    }
    setCurrRooms(roomsArr);
  }

  async function GetUserRoomDetails(addr: string, roomName: string) {
    const r = readers[0];
    const account = accountsState[addr];

    if (!r || !account) {
      alert("Please reload the page to make sure readers and accounts have been initialized");
      return;
    }

    var addrUnit256 = account.wallet?.wallet.addressToUint256(addr) || null;
    // console.log("======== account (addrUnit256) is: ", addrUnit256);
    // console.log("======== account is: ", account);
    const a = r.addressToUint256(addr);
    console.log("======== account (addrUnit256) is: ", a);

    const messages = await r.retrieveMessageHistoryByBounds(addr, a);
    console.log("========= all messages are: ", messages);

    for (var message of messages) {
      const content = await r.retrieveAndVerifyMessageContent(message);
      if (!content || content.corrupted) { // check content integrity
        throw new Error('Content not found or corrupted');
      }
      // console.log("content is: ", content);
      // console.log("message is: ", message);
      // console.log("======== keystore keys are: ", keystore.get(addr));

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
        // console.log("======== decoded content is: ", decodedContent);
        if (decodedContent?.subject.startsWith("ROOM CREATED")) {
          console.log(`got a room: ${decodedContent.subject.split(":")[1]} with data: ${decodedContent.content}. Asked room: ${roomName}`);
          const rName = decodedContent.subject.split(":")[1];
          if (rName == roomName) {
            return decodedContent.content;
          }
        }
      } else {
        console.log("========= no public key!");
        alert("make sure generate and publish functions have been called and app state is initialized");
      }
    }
  }

  async function GetCreatorRoomByName(roomName: string, creatorAddr: string) {
    const roomDetails = await GetUserRoomDetails(creatorAddr, roomName);
    console.log("room details are: ", roomDetails);
  }

  async function CreatePost(roomName: string, postSubject: string, postBody: string, creatorAddr: string) {
    const roomDetails = await GetUserRoomDetails(creatorAddr, roomName);
    console.log("room details are: ", roomDetails);

    const rDetails = JSON.parse(roomDetails);
    console.log("All Recipients are: ", rDetails["recipients"]);

    const reps = rDetails["recipients"];
    sendPostMessage(creatorAddr, roomName, postSubject, postBody, reps);
  }

  async function sendPostMessage(creatorAddr: string, roomName: string, postSubject: string, postBody: string, recipientAccounts: string[]) {
    if (!ylide) {
      alert("No ylide sdk initialized. Reload the page");
      return;
    }
    const fromAcc = accounts.find((a) => a.address === creatorAddr);
    if (!fromAcc) {
      alert("Specify the room creator...");
      return;
    }
    const state = accountsState[fromAcc.address];
    if (!state) {
      console.log("Room creator does not have state initialized. Do the above operations first to register the creator");
      return;
    }

    const msgSubject = `POST:${postSubject}`;
    const msgBody = {
      "creator_address": fromAcc,
      "post": postBody,
      "room": roomName
    };
    const content = MessageContentV3.plain(msgSubject, JSON.stringify(msgBody));
    const msgId = await ylide.sendMessage(
      {
        wallet: state.wallet!.wallet,
        sender: (await state.wallet!.wallet.getAuthenticatedAccount())!,
        content,
        recipients: recipientAccounts,
      },
      { network: EVMNetwork.ARBITRUM }
    );
    alert(`Post Message Sent with MessageId: ${msgId}`);
    console.log(`Post Message Sent with MessageId: ${msgId}`);
  }

  async function ReadPostMessages(addr: string, roomName: string) {
    const r = readers[0];
    const account = accountsState[addr];

    if (!r || !account) {
      alert("Please reload the page to make sure readers and accounts have been initialized");
      return;
    }

    var addrUnit256 = account.wallet?.wallet.addressToUint256(addr) || null;
    // console.log("======== account (addrUnit256) is: ", addrUnit256);
    // console.log("======== account is: ", account);
    const a = r.addressToUint256(addr);
    console.log("======== account (addrUnit256) is: ", a);

    const messages = await r.retrieveMessageHistoryByBounds(addr, a);
    console.log("========= all messages are: ", messages);

    for (var message of messages) {
      const content = await r.retrieveAndVerifyMessageContent(message);
      if (!content || content.corrupted) { // check content integrity
        throw new Error('Content not found or corrupted');
      }
      // console.log("content is: ", content);
      // console.log("message is: ", message);
      // console.log("======== keystore keys are: ", keystore.get(addr));

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
        // console.log("======== decoded content is: ", decodedContent);
        if (decodedContent?.subject.startsWith("POST")) {
          console.log(`got a post with subject: ${decodedContent.subject.split(":")[1]} with data: ${decodedContent.content}. and room: ${roomName}`);
          const sub = decodedContent.subject.split(":")[1];
          const msg = JSON.parse(decodedContent.content);
          console.log(`Post subject: ${sub}, body: ${msg["post"]}`);
        }
      } else {
        console.log("========= no public key!");
        alert("make sure generate and publish functions have been called and app state is initialized");
      }
    }
  }

  async function isCurrAccountOnboarded() {
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
    if (currAcc) {
      const wallet = wallets.find(
        (w) => w.factory.wallet === currAcc.wallet
      );
      result[currAcc.address] = {
        wallet: wallet || null,
        localKey:
          keys.find((k) => k.address === currAcc.address)?.keypair ||
          null,
        remoteKey:
          (
            await Promise.all(
              readers.map(async (r) => {
                if (!r.isAddressValid(currAcc.address)) {
                  return null;
                }
                const c =
                  await r.extractPublicKeyFromAddress(
                    currAcc.address
                  );
                if (c) {
                  console.log(
                    `NEW found public key for ${currAcc.address} in `,
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
      setCurrAccState(result);
      return true;
    }
    return false;
  }

  return (
    <div className="App">

      <Navbar bg="light" expand="lg">
        <Container fluid>
          <div className="d-flex justify-content-center align-items-center ml-2 ml-lg-0">
            <Button
              variant="dark"
              className="d-lg-none btn-fill d-flex justify-content-center align-items-center rounded-circle p-2"
            >
              <i className="fas fa-ellipsis-v"></i>
            </Button>
            <Navbar.Brand
              href="#home"
              className="mr-2"
            >
              Whispering Rooms
            </Navbar.Brand>
          </div>
          <Navbar.Toggle aria-controls="basic-navbar-nav" className="mr-2">
            <span className="navbar-toggler-bar burger-lines"></span>
            <span className="navbar-toggler-bar burger-lines"></span>
            <span className="navbar-toggler-bar burger-lines"></span>
          </Navbar.Toggle>
          {currAcc ? <Button variant='success'>Wallet Connected</Button> : <Button onClick={() => addAccount(walletsList[0].factory)}>Connect Wallet</Button>}
        </Container>
      </Navbar>

      {
        currAcc ?
          <Container fluid>
            <Card>
              <Card.Body>
                <Card.Title>Connected Address</Card.Title>
                <Card.Subtitle className="mb-2 text-muted">{currAcc.address}</Card.Subtitle>
              </Card.Body>
            </Card>
            <Row className='mt-2'>
              <Navbar bg="light" expand="lg">
                <Container fluid>
                  <div className="d-flex justify-content-center align-items-center ml-2 ml-lg-0">
                    <Button variant='primary' onClick={() => GetMyRooms(currAcc?.address)}>My Private Rooms</Button>
                  </div>
                  <div className='d-flex justify-content-right align-items-right ml-2 ml-lg-0'>
                    <Button variant='danger' onClick={() => GetMyRooms(currAcc?.address)}>Create a Private Room</Button>
                  </div>
                </Container>
              </Navbar>
            </Row>
          </Container>
          :
          <IntroPage />
      }

      {currAcc && currRooms.length > 0 ? <Container fluid>
        <CardGroup>
          {currRooms.map(r => (
            <Card>
              <div className="card-image">
                <img
                  alt="Room Placeholder Image"
                  src='https://via.placeholder.com/600x200.png'
                ></img>
              </div>
              <Card.Body>
                <Card.Title>{r.roomName}</Card.Title>
                <Card.Text>
                  Your Private Room with {r.recipients.length - 2} recipients. This room remains private and only the recipients can see your messages!
                </Card.Text>
              </Card.Body>
              <hr></hr>
              <div className="button-container mr-auto ml-auto mb-2 justify-content-right align-items-right">
                <Button
                  className="btn-simple btn-icon"
                  href="#pablo"
                  onClick={(e) => e.preventDefault()}
                  size='sm'
                  variant="primary"
                >
                  Enter Room
                </Button>
              </div>
            </Card>
          ))}
        </CardGroup>
      </Container> : <Container fluid><h4>Loading Room list... Please wait</h4></Container>}

      {/* <header className="App-header">
        <Accordion defaultActiveKey="0" className='container'>

          <Accordion.Item eventKey="2">
            <Accordion.Header>See all Connected Accounts</Accordion.Header>
            <Accordion.Body>
              <div className='container'>
                This will display all the connected accounts in the browser console. These accounts have been added to the state and have been registered with the Ylide SDK as well
              </div>
              <div className='container mt-2'>
                <Button onClick={getAddedAccounts}>See all added accounts</Button>
              </div>
            </Accordion.Body>
          </Accordion.Item>

          <Accordion.Item eventKey="3">
            <Accordion.Header>Generate New Key for account: {accounts[1].address}</Accordion.Header>
            <Accordion.Body>
              <div className='container'>
                This will generate a new key locally for the account {accounts[1].address} and store it in browser localStorage.
              </div>
              <div className='container mt-2'>
                <Button onClick={() => generateKey(accounts[1].wallet, accounts[1].address)}>Generate key for {accounts[1].address}</Button>
              </div>
            </Accordion.Body>
          </Accordion.Item>

          <Accordion.Item eventKey="4">
            <Accordion.Header>Publish key for account: {accounts[1].address}</Accordion.Header>
            <Accordion.Body>
              <div className='container'>
                This will publish the locally available key for the account {accounts[1].address} to the selected blockchain(ARBITRUM).
              </div>
              <div className='container mt-2'>
                <Button onClick={() => publishKey(accounts[1].wallet, accounts[1].address)}>Publish key for {accounts[1].address}</Button>
              </div>
            </Accordion.Body>
          </Accordion.Item>

          <Accordion.Item eventKey="5">
            <Accordion.Header>Create a room with Creattor Account: {accounts[0].address}</Accordion.Header>
            <Accordion.Body>
              <div className='container'>
                This will create a new private whispering room (Name hardcoded to WhisperingRoom01) with owner account address: {accounts[0].address}. This owner is responsible for managing the state of the room and will be able to send messages to the room recipients. <br />
                For now, the following recipients have been hardcoded below, but the room creator should be able to specify a list of addresses while creating the room.
                <ul>
                  <li>
                    <span>0x9A9B3fBb7c83D82E7cF696d6F2ecCa35Ba00C356</span>
                  </li>
                  <li>
                    <span>0x1A2F3477E23B1Aa8345697ae6Fa376025ceaf3Ca</span>
                  </li>
                </ul>
              </div>
              <div className='container mt-2'>
                <Button onClick={() => createRoom("WhisperingRoom01", accounts[0].address, ["0x9A9B3fBb7c83D82E7cF696d6F2ecCa35Ba00C356", "0x1A2F3477E23B1Aa8345697ae6Fa376025ceaf3Ca", PLATFORM_ADDRESS])}>Create Room with creator: {accounts[0].address}</Button>
              </div>
            </Accordion.Body>
          </Accordion.Item>

          <Accordion.Item eventKey="6">
            <Accordion.Header>See all rooms for address: 0x9A9B3fBb7c83D82E7cF696d6F2ecCa35Ba00C356</Accordion.Header>
            <Accordion.Body>
              <div className='container'>
                This will list down all the rooms that the given user is a part of. We read all messages sent to this address
                and see the message where subject starts with [ROOM CREATED]. <br />
                Note: Make sure this address has been registered with Ylide and all data is available in the app state for this user 0x9A9B3fBb7c83D82E7cF696d6F2ecCa35Ba00C356
              </div>
              <div className='container mt-2'>
                <Button onClick={() => GetMyRooms("0x9a9b3fbb7c83d82e7cf696d6f2ecca35ba00c356")}>Get all rooms for: 0x9A9B3fBb7c83D82E7cF696d6F2ecCa35Ba00C356</Button>
              </div>
            </Accordion.Body>
          </Accordion.Item>

          <Accordion.Item eventKey="7">
            <Accordion.Header>Show all room details for room: WhisperingRoom01 by creator</Accordion.Header>
            <Accordion.Body>
              <div className='container'>
                This will show up all the room details of the room created by the user in the previous steps
              </div>
              <div className='container mt-2'>
                <Button onClick={() => GetCreatorRoomByName("WhisperingRoom01", accounts[0].address)}>Get Creator({accounts[0].address}) Room(WhisperingRoom01) Details (See Console for Details)</Button>
              </div>
            </Accordion.Body>
          </Accordion.Item>

          <Accordion.Item eventKey="8">
            <Accordion.Header>Create Post for all members of the room: WhisperingRoom01</Accordion.Header>
            <Accordion.Body>
              <div className='container'>
                This will send a message to all recipients of the room that the creator has created in the previous step.
              </div>
              <div className='container mt-2'>
                <Button onClick={() => CreatePost("WhisperingRoom01", "Random Post01", "Random Post Body01", accounts[0].address)}>Create Post for Room: WhisperingRoom01 created by {accounts[0].address}</Button>
              </div>
            </Accordion.Body>
          </Accordion.Item>

          <Accordion.Item eventKey="9">
            <Accordion.Header>Read Posts from: WhisperingRoom01, for user: 0x9a9b3fbb7c83d82e7cf696d6f2ecca35ba00c356</Accordion.Header>
            <Accordion.Body>
              <div className='container'>
                This will read all messages sent to the address: 0x9a9b3fbb7c83d82e7cf696d6f2ecca35ba00c356
              </div>
              <div className='container mt-2'>
                <Button onClick={() => ReadPostMessages("0x9a9b3fbb7c83d82e7cf696d6f2ecca35ba00c356", "WhisperingRoom01")}>Read All Posts for user: 0x9a9b3fbb7c83d82e7cf696d6f2ecca35ba00c356</Button>
              </div>
            </Accordion.Body>
          </Accordion.Item>

        </Accordion>

      </header> */}
    </div >
  );
}

export default App;
