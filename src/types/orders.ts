import { BigNumberish, BytesLike } from "ethers";

/**
 * /!\ This type is used for the signature and should perfectly match the object signed by the user
 * Do not update unless the contract has been updated
 */
export interface MakerOrder {
  isOrderAsk: boolean; // true --> ask / false --> bid
  signer: string; // signer address of the maker order
  collection: string; // collection address
  price: BigNumberish;
  tokenId: BigNumberish; // id of the token
  amount: BigNumberish; // amount of tokens to sell/purchase (must be 1 for ERC721, 1+ for ERC1155)
  strategy: string; // strategy for trade execution (e.g., DutchAuction, StandardSaleForFixedPrice)
  currency: string; // currency address
  nonce: BigNumberish; // order nonce (must be unique unless new maker order is meant to override existing one e.g., lower ask price)
  startTime: BigNumberish; // startTime in timestamp
  endTime: BigNumberish; // endTime in timestamp
  minPercentageToAsk: BigNumberish;
  params: BytesLike;
}


/** MakerOrderWithVRS match the type sent to the contract when executing a trade */
export interface MakerOrderWithVRS extends Omit<MakerOrder, "params"> {
  v: number;
  r: string;
  s: string;
  params: BytesLike;
}

export interface TakerOrder {
  isOrderAsk: boolean; // true --> ask / false --> bid
  taker: string; // Taker address
  price: BigNumberish; // price for the purchase
  tokenId: BigNumberish;
  minPercentageToAsk: BigNumberish;
  params: BytesLike;
}

export interface CreateMakerInput {
  collection: string; // collection address
  price: BigNumberish;
  tokenId: BigNumberish; // id of the token
  amount?: BigNumberish; // amount of tokens to sell/purchase (must be 1 for ERC721, 1+ for ERC1155)
  strategy?: string; // strategy for trade execution (e.g., DutchAuction, StandardSaleForFixedPrice)
  currency?: string; // currency address
  nonce: BigNumberish; // order nonce (must be unique unless new maker order is meant to override existing one e.g., lower ask price)
  startTime?: BigNumberish; // startTime in timestamp
  endTime: BigNumberish; // endTime in timestamp
  minPercentageToAsk?: BigNumberish;
  params?: any[]; // params (e.g., price, target account for private sale)
}

export interface CreateMakerCollectionOfferInput {
  collection: string; // collection address
  price: BigNumberish;
  amount?: BigNumberish; // amount of tokens to sell/purchase (must be 1 for ERC721, 1+ for ERC1155)
  strategy?: string; // strategy for trade execution (e.g., DutchAuction, StandardSaleForFixedPrice)
  currency?: string; // currency address
  nonce: BigNumberish; // order nonce (must be unique unless new maker order is meant to override existing one e.g., lower ask price)
  startTime?: BigNumberish; // startTime in timestamp
  endTime: BigNumberish; // endTime in timestamp
  minPercentageToAsk?: BigNumberish;
  params?: any[]; // params (e.g., price, target account for private sale)
}

export interface CreateTakerInput { 
  taker: string;
  minPercentageToAsk?: BigNumberish;
  params?: any[]
}

export interface CreateMakerAskOutput {
  maker: MakerOrder;
  isCollectionApproved: boolean;
}

export interface CreateMakerBidOutput {
  maker: MakerOrder;
  isCurrencyApproved: boolean;
}