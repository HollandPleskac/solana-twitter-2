import * as anchor from '@project-serum/anchor'
import { Program } from '@project-serum/anchor'
import { SolanaTwitter } from '../target/types/solana_twitter'
import * as assert from 'assert'
import * as bs58 from 'bs58'

// https://lorisleiva.com/create-a-solana-dapp-from-scratch/testing-our-instruction#a-client-just-for-tests
describe('solana-twitter', () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env())

  const program = anchor.workspace.SolanaTwitter as Program<SolanaTwitter>

  // it("Is initialized!", async () => {
  //   // Add your test here.
  //   const tx = await program.methods.initialize().rpc();
  //   console.log("Your transaction signature", tx);
  // });

  const anchorProvider = program.provider as anchor.AnchorProvider // program.provider.wallet ts err

  it('can send a new tweet', async () => {
    // Before sending the transaction to the blockchain.

    // Since this is the account our instruction will create, we just need to generate a new key pair for it. That way, we can also prove we are allowed to initialise an account at this address because we can add the tweet account as a signer.
    const tweet = anchor.web3.Keypair.generate()

    // anchor automatically provides key pair of our wallet *
    // context is last argument and requires all account for instruction to be successful
    await program.methods
      .sendTweet('veganism', 'Hummus, am I right?')
      .accounts({
        // Accounts here...
        tweet: tweet.publicKey,
        author: anchorProvider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId, // public key = anchor.web3.SystemProgram.programId
      })
      .signers([tweet])
      .rpc()

    // After sending the transaction to the blockchain.

    // Fetch the account details of the created tweet.
    const tweetAccount = await program.account.tweet.fetch(tweet.publicKey)
    // console.log(tweetAccount)

    // Ensure it has the right data.
    // tweetAccount.author and anchorProvider.wallet.publicKey are objects and have different references so toBase58() lets us compare them as strings
    assert.equal(
      tweetAccount.author.toBase58(),
      anchorProvider.wallet.publicKey.toBase58()
    )
    assert.equal(tweetAccount.topic, 'veganism')
    assert.equal(tweetAccount.content, 'Hummus, am I right?')
    assert.ok(tweetAccount.timestamp)
  })

  it('can send new tweet without topic', async () => {
    const tweet = anchor.web3.Keypair.generate()

    await program.methods
      .sendTweet('', 'gm')
      .accounts({
        tweet: tweet.publicKey,
        author: anchorProvider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([tweet])
      .rpc()

    const tweetAccount = await program.account.tweet.fetch(tweet.publicKey)

    assert.equal(
      tweetAccount.author.toBase58(),
      anchorProvider.wallet.publicKey.toBase58()
    )
    assert.equal(tweetAccount.topic, '')
    assert.equal(tweetAccount.content, 'gm')
    assert.ok(tweetAccount.timestamp)
  })

  it('can send new tweet without topic', async () => {
    // Generate another user and airdrop them some SOL.
    const otherUser = anchor.web3.Keypair.generate()
    const signature = await program.provider.connection.requestAirdrop(
      otherUser.publicKey,
      1000000000
    ) // only requests the airdrop
    await program.provider.connection.confirmTransaction(signature) // wait for tx to confirm to make sure user has money in their account

    // Call the "SendTweet" instruction on behalf of this other user.
    const tweet = anchor.web3.Keypair.generate()
    await program.methods
      .sendTweet('hi', 'bye')
      .accounts({
        tweet: tweet.publicKey,
        author: otherUser.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([otherUser, tweet])
      .rpc()

    const tweetAccount = await program.account.tweet.fetch(tweet.publicKey)

    assert.equal(tweetAccount.author.toBase58(), otherUser.publicKey.toBase58()) //
    assert.equal(tweetAccount.topic, 'hi')
    assert.equal(tweetAccount.content, 'bye')
    assert.ok(tweetAccount.timestamp)
  })

  it('cannot provide topic with more than 50 characters', async () => {
    try {
      const tweet = anchor.web3.Keypair.generate()
      const topicWith51Chars = 'x'.repeat(51)
      await program.methods
        .sendTweet(topicWith51Chars, 'Hummus, am I right?')
        .accounts({
          tweet: tweet.publicKey,
          author: anchorProvider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([tweet])
        .rpc()
    } catch (err) {
      assert.equal(
        err.error.errorMessage,
        'The provided topic should be 50 characters long maximum.'
      )
      return
    }
    // we should have returned inside the catch block so we can assert.fail after the try/catch
    assert.fail('The instruction should have failed with a 51-character topic.')
  })

  it('cannot provide content with more than 280 characters', async () => {
    try {
      const tweet = anchor.web3.Keypair.generate()
      const contentWith51Chars = 'x'.repeat(281)
      await program.methods
        .sendTweet('veganism', contentWith51Chars)
        .accounts({
          tweet: tweet.publicKey,
          author: anchorProvider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([tweet])
        .rpc()
    } catch (err) {
      assert.equal(
        err.error.errorMessage,
        'The provided content should be 280 characters long maximum.'
      )
      return
    }
    // we should have returned inside the catch block so we can assert.fail after the try/catch
    assert.fail(
      'The instruction should have failed with a 281-character content.'
    )
  })

  it('can fetch all accounts', async () => {
    const tweetAccounts = await program.account.tweet.all() // grab all tweet accounts
    assert.equal(tweetAccounts.length, 3) // 3 tweet accounts created by the previous tests
  })

  it('can filter tweets by author', async () => {
    // memcmp will compare bytes to an offset
    const authorPublicKey = anchorProvider.wallet.publicKey
    const tweetAccounts = await program.account.tweet.all([
      {
        memcmp: {
          offset: 8, //Discriminator.
          bytes: authorPublicKey.toBase58(),
        },
      },
    ]) // grab all tweet accounts
    assert.equal(tweetAccounts.length, 2) // 2 tweet accounts created by out wallet
    // .every returns true only if the callback returns true for every account
    assert.ok(
      tweetAccounts.every((tweetAccount) => {
        return (
          tweetAccount.account.author.toBase58() === authorPublicKey.toBase58()
        )
      })
    )
  })

  it('can filter by author', async () => {
    const tweetAccounts = await program.account.tweet.all([
      {
        memcmp: {
          offset:
            8 + // Discriminator.
            32 + // Author public key.
            8 + // Timestamp.
            4, // Topic string prefix.
          bytes: bs58.encode(Buffer.from('veganism')), // encode veganism topic so bytes for comparison with memcmp filter
        },
      },
    ])
    assert.equal(tweetAccounts.length, 1)
    assert.ok((tweetAccount) => tweetAccount.account.topic === 'veganism')
  })
})

/* notes on assert
Ensure two things are equal using assert.equal(actualThing, expectedThing).
Ensure something is truthy using assert.ok(something).
*/

/* notes on why u dont need to airdrop your wallet account money to do tests
when local ledger is spun up, it airdrops 500 million sol to your local wallet located at ~/.config/solana/id.json 2323
*/
