## General Summary
Non-custodial staking will be built in the following sections:

**Frontend**
* [React Native for Web, managed via Expo](https://docs.expo.dev/get-started/create-a-new-app/)
* Excellent library for managing websites. Use `expo web` to start projects for web after following the above guide.

**Backend**
* [ExpressJS via Node](https://stackabuse.com/building-a-rest-api-with-node-and-express/)
* Provide endpoints for frontend to update the off-chain database.
* Also uses [solana/web3.js](https://solana-labs.github.io/solana-web3.js/) for interacting with chain for certain requests to verify transactions, for example when requesting to claim. 

**Scheduler**
* Built using Node and Toad Scheduler. Cymi will take lead on this: It will reference the database to update database state to reflect unstaked NFTs and perform claim updates based on NFT checks for those currently marked as staked.

I have pulled several files and made some examples to demonstrate how solana/web3.js works in application on Time Pixie software so far, including the largest API problem we will face and a frontend example of interacting with wallets, then passing it to the API.

## Transaction Verification (Challenge to Overcome)
In order to verify a wallet submitting a request to the API, we need to check if they are legitimate or someone posing as the wallet.

We do this with a function similar to this. I haven't gotten a working version yet, because sometimes `connect.getTransaction()` does not ever return a proper value, even after many tries despite a `tx` turning out to be valid later. 

The logic mostly works fine (checking the two supplies addresses are present in the transaction, and block time `slot` is recent) but that tx not always returning can be problematic. 

```javascript
// Storage is Pixie treasury, address is the user.
const verifyTransaction = async (tx, storage, address) => {

  // Get tx info.
  var info = null
  var count = 0
  while (info == null && count < 50) {
    try {
      const connect = new Connection(rpcurl);
      info = await connect.getTransaction(tx)
      if (info != null) {
        break
      } else {
        await delay(3000)
        count++
      }
    } catch (e) {
      console.log(e)
      if (e.toString().includes("Wrong Size") || e.toString().includes("WrongSize")) {
        // This error happens occasionally but it seems transactions that throw it are always correct.
        return true
      }
      count++
    }
  }

  // Check if tx could be found.
  if (info != null) {
    // Ensure this transaction was recent.
    var tx_slot = info.slot

    // Check slot difference.
    var diff = slot-tx_slot

    if (diff < -1000 || diff > 1000) {
      console.log('tx is here with diff invalid '+diff+' '+slot+' '+tx_slot+'\n'+sig)
      return false
    }

    // Find accountKeys index for address and treasury.
    var addressIndex = -1
    var storageIndex = -1
    for (var i=0; i < info.transaction.message.accountKeys.length; i++) {
      if (info.transaction.message.accountKeys[i].toString().includes(address)) {
        addressIndex = i
      } else if (info.transaction.message.accountKeys[i].toString().includes(storage)) {
        storageIndex = i
      }
    }
    if (addressIndex != -1 && storageIndex != -1) {
        console.log('Both addresses are present in transaction, success!')
        return true
    } else {
      console.log('tx failed: did not find user in address',tx)
    }
  } else {
    console.log('tx failed: transaction does not exist',tx)
  }

  return false
}
```

## Quests.js (Frontend Example)
This file demonstrates using the solana library to connect a wallet to the site. Notice the functions imported in the file from API.js and the role they play in contacting the questing API. This file also can create a transaction based on props passed by a parent component.

These props include functions to update data in the parent, data about the quest, the NFT, and a provider passed that was generated like so. I have also included an images directory that has screenshots of various steps that you can also see in Quests.js.

```javascript
const selectSpecificWallet = async (n) => {
    setWalletType(n)
    if (n == 0) {
      await attemptPhantomConnect()
    } else {
      await attemptSolflareConnect()
    }
}

const attemptPhantomConnect = async () => {
    closeWalletSelector()
    try {
        if (!window.solana.isConnected) {

            //console.log('Phantom needs to be connected to.')

            const resp = await window.solana.connect();
            //console.log('Phantom connected:',resp.publicKey.toString())
            setWalletPublicKey(resp.publicKey.toString())
            setWalletConnected(true)
            setWalletProvider(resp)

            await startNftFetch(resp)

        } else {

            //console.log('Phantom is already connected.')

            const resp = await window.solana.connect({ onlyIfTrusted: true });
            //console.log('Phantom connected:',resp.publicKey.toString())
            setWalletPublicKey(resp.publicKey.toString())
            setWalletConnected(true)
            setWalletProvider(resp)

            await startNftFetch(resp)
            
        }
    } catch (e) {

    }

    
}

const attemptSolflareConnect = async () => {
    closeWalletSelector()
    try {
        if (!window.solflare.isConnected) {

            //console.log('Phantom needs to be connected to.')

            const resp = await window.solflare.connect();

            if (resp) {
                //console.log('Phantom connected:',resp.publicKey.toString())
                var key = window.solflare.publicKey.toString()
                setWalletPublicKey(key)
                setWalletConnected(true)
                setWalletProvider(window.solflare)
    
                await startNftFetch(window.solflare)

            }
            
        } else {

            //console.log('Phantom is already connected.')

            const resp = await window.solflare.connect({ onlyIfTrusted: true });

            if (resp) {
                //console.log('Phantom connected:',resp.publicKey.toString())
                var key = window.solflare.publicKey.toString()
                setWalletPublicKey(key)
                setWalletConnected(true)
                setWalletProvider(window.solflare)
    
                await startNftFetch(window.solflare)

            }
            
        }
    } catch (e) {
        console.log(e)
    }

    
}
```