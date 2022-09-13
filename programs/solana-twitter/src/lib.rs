use anchor_lang::prelude::*;

declare_id!("2YdvgszBrPt3Ta3CPn27LAtbb8o53YRvbGKfQVVS8fdS");

#[program]
pub mod solana_twitter {
  use super::*;

  // changed ProgramResult to Result<()> like on ep-4 github branch
  pub fn send_tweet(ctx: Context<SendTweet>, topic: String, content: String) -> Result<()> {
    let tweet: &mut Account<Tweet> = &mut ctx.accounts.tweet; // access tweet account
    let author: &Signer = &ctx.accounts.author; // don't need mut because Anchor already took care of the rent-exempt payment.
    let clock: Clock = Clock::get().unwrap(); // can only work if the System Program is provided as an account.
    if topic.chars().count() > 50 {
      return Err(error!(ErrorCode::TopicTooLong));
    }
    if content.chars().count() > 280 {
      return Err(error!(ErrorCode::ContentTooLong));
    }

    tweet.author = *author.key;
    tweet.timestamp = clock.unix_timestamp;
    tweet.topic = topic;
    tweet.content = content;
    Ok(())
  }
}

// 4. account context for program
#[derive(Accounts)]
pub struct SendTweet<'info> {
  #[account(init, payer = author, space = Tweet::LEN)]
  pub tweet: Account<'info, Tweet>, // account of type Tweet and the data should be parsed accordingly.
  #[account(mut)]
  // because we're saying that the author should pay for the rent-exempt money of the tweet account, we need to mark the author property as mutable. That's because we are going to mutate the amount of money in their account.
  pub author: Signer<'info>, // same as the AccountInfo type except we're also saying this account should sign the instruction.
  // represents any account, the account's data will be an unparsed array of bytes.
  // #[account(address = system_program::ID)] // make sure system_program is official and not maliciously provided by users
  // pub system_program: AccountInfo<'info>, // used to initialize the Tweet account and figure out how much money we need to be rent-exempt.
  pub system_program: Program<'info, System>, // make sure its official system program by passing the System type in
}
// 1. Define the structure of the Tweet account.
#[account]
pub struct Tweet {
  pub author: Pubkey,
  pub timestamp: i64,
  pub topic: String,
  pub content: String,
}

// 2. Add some useful constants for sizing propeties.
const DISCRIMINATOR_LENGTH: usize = 8; // keep track of account type
const PUBLIC_KEY_LENGTH: usize = 32; // ctrl + click on Pubkey to see u8 bits * 32 spaces (8 bits * 32 spaces is 32 bytes because 8 bit = 1 byte)
const TIMESTAMP_LENGTH: usize = 8; // i64 is integer of 64 bits
const STRING_LENGTH_PREFIX: usize = 4; // Stores the size of the string.
const MAX_TOPIC_LENGTH: usize = 50 * 4; // 50 chars max. for topics (set by us!)
const MAX_CONTENT_LENGTH: usize = 280 * 4; // 280 chars max.
                                           // space refs table https://lorisleiva.com/create-a-solana-dapp-from-scratch/structuring-our-tweet-account

// 3. Add a constant on the Tweet account that provides its total size.
impl Tweet {
  const LEN: usize = DISCRIMINATOR_LENGTH
      + PUBLIC_KEY_LENGTH // Author.
      + TIMESTAMP_LENGTH // Timestamp.
      + STRING_LENGTH_PREFIX + MAX_TOPIC_LENGTH // Topic.
      + STRING_LENGTH_PREFIX + MAX_CONTENT_LENGTH; // Content.
}

#[error_code]
pub enum ErrorCode {
  #[msg("The provided topic should be 50 characters long maximum.")]
  TopicTooLong,
  #[msg("The provided content should be 280 characters long maximum.")]
  ContentTooLong,
}

#[error_code]
pub enum OtherErrCode {
  #[msg("This is another error code that I'm writing")]
  OtherCode1,
  #[msg("This is error code 2")]
  ErrorCode2,
}
