import { ethers } from "hardhat";
import { expect } from "chai";

import { getSigners, setUpContracts, SetupMocks, Signers } from "./helpers/setup"
import { LooksRare } from "../LooksRare"
import { OrderValidatorEnum, SupportedChainId } from "../types"
import { ErrorSigner, ErrorTimestamp } from "../errors";
import { CreateMakerCollectionOfferInput, CreateMakerInput, MakerOrder, TakerOrder } from "../types/orders";
import { BigNumber, constants, utils } from "ethers";
import { allowance, isApprovedForAll } from "../utils/calls/tokens";
import { TypedDataDomain } from "@ethersproject/abstract-signer";
import { makerTypes } from "../constants/eip712";

describe("LooksRare", () => {
  let mocks: SetupMocks;
  let signers: Signers;

  beforeEach(async () => {
    mocks = await setUpContracts();
    signers = await getSigners();
  })

  describe("constructor", () => {
    it("instanciate LooksRare object with a signer", () => {
      expect(new LooksRare(1, ethers.provider, signers.user1).chainId).to.equal(1);
      expect(new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user1).chainId).to.equal(
        SupportedChainId.HARDHAT
      );
    });
    it("instanciate LooksRare object with a signer and override addresses", () => {
      const { addresses } = mocks;
      const lr = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user1, addresses);
      expect(lr.addresses).to.be.eql(addresses);
    });
    it("instanciate LooksRare object without a signer and reject a contract call", async () => {
      const lr = new LooksRare(SupportedChainId.HARDHAT, ethers.provider);
      expect(lr.getTypedDataDomain().chainId).to.be.eql(SupportedChainId.HARDHAT);
      expect(() => lr.cancelAllOrdersForSender(0)).to.throw(ErrorSigner);
    });
  })

  describe("createMakerAsk", () => {
    let baseMakerAskInput: CreateMakerInput;

    beforeEach(() => {
      baseMakerAskInput = {
        collection: mocks.contracts.collectionERC721.address,
        price: utils.parseEther("1"),
        tokenId: 0,
        strategy: mocks.contracts.strategyStandardSaleForFixedPrice.address,
        nonce: 0,
        endTime: Math.floor(Date.now() / 1000) + 3600,
        minPercentageToAsk: 0,
      }
    })

    it("create maker ask with wrong time format", async () => {
      const looksrare = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user1, mocks.addresses);
      await expect(
        looksrare.createMakerAsk({ ...baseMakerAskInput, startTime: Date.now() })
      ).to.eventually.be.rejectedWith(ErrorTimestamp);
      await expect(looksrare.createMakerAsk({ ...baseMakerAskInput, endTime: Date.now() })).to.eventually.be.rejectedWith(
        ErrorTimestamp
      );
    });

    it("approvals checks are false if no approval was made", async () => {
      const looksrare = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user1, mocks.addresses);
      const { isCollectionApproved } = await looksrare.createMakerAsk(baseMakerAskInput);
      expect(isCollectionApproved).to.be.false;
  
      const tx = await looksrare.approveAllCollectionItems(baseMakerAskInput.collection);
      await tx.wait();
      const isApproved = await isApprovedForAll(
        ethers.provider,
        baseMakerAskInput.collection,
        signers.user1.address,
        mocks.addresses.TRANSFER_MANAGER_ERC721
      );
      expect(isApproved).to.be.true;
    });

    it("approval checks are true if approval were made", async () => {
      const looksrare = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user1, mocks.addresses);
      const tx = await looksrare.approveAllCollectionItems(baseMakerAskInput.collection);
      await tx.wait();
  
      const { isCollectionApproved } = await looksrare.createMakerAsk(baseMakerAskInput);
      expect(isCollectionApproved).to.be.true;
    });

    it("create a simple maker ask with default values", async () => {
      const looksrare = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user1, mocks.addresses);
      const output = await looksrare.createMakerAsk(baseMakerAskInput);
      const makerOrder: MakerOrder = {
        isOrderAsk: true,
        signer: signers.user1.address,
        collection: mocks.contracts.collectionERC721.address,
        price: utils.parseEther("1"),
        tokenId: 0,
        amount: 1,
        strategy: mocks.contracts.strategyStandardSaleForFixedPrice.address,
        currency: mocks.contracts.weth.address,
        nonce: 0,
        startTime: Math.floor(Date.now() / 1000),
        endTime: Math.floor(Date.now() / 1000) + 3600,
        minPercentageToAsk: 0,
        params: "0x"
      };
      expect(output.maker).to.eql(makerOrder);
    });

    it("create a simple maker ask with non default values", async () => {
      const looksrare = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user1, mocks.addresses);
      const input = {
        ...baseMakerAskInput,
        amount: 2,
        currency: mocks.contracts.usdt.address,
        startTime: Math.floor(Date.now() / 1000),
        taker: signers.user2.address,
        params: [],
      };
      const output = await looksrare.createMakerAsk(input);
      const makerOrder: MakerOrder = {
        isOrderAsk: true,
        signer: signers.user1.address,
        collection: mocks.contracts.collectionERC721.address,
        price: utils.parseEther("1"),
        tokenId: 0,
        amount: 2,
        strategy: mocks.contracts.strategyStandardSaleForFixedPrice.address,
        currency: mocks.contracts.usdt.address,
        nonce: 0,
        startTime: Math.floor(Date.now() / 1000),
        endTime: Math.floor(Date.now() / 1000) + 3600,
        minPercentageToAsk: 0,
        params: "0x"
      };
      expect(output.maker).to.eql(makerOrder);
    });
  })

  describe("createMakerBid", () => {
    let baseMakerBidInput: CreateMakerInput;

    beforeEach(async () => {
      baseMakerBidInput = {
        collection: mocks.contracts.collectionERC721.address,
        price: utils.parseEther("1"),
        tokenId: 0,
        strategy: mocks.contracts.strategyStandardSaleForFixedPrice.address,
        nonce: 0,
        endTime: Math.floor(Date.now() / 1000) + 3600,
        minPercentageToAsk: 0,
      }
    });

    it("create maker bid with wrong time format", async () => {
      const looksrare = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user1, mocks.addresses);
      await expect(looksrare.createMakerBid({ ...baseMakerBidInput, startTime: Date.now() })).to.eventually.be.rejectedWith(
        ErrorTimestamp
      );
      await expect(looksrare.createMakerBid({ ...baseMakerBidInput, endTime: Date.now() })).to.eventually.be.rejectedWith(
        ErrorTimestamp
      );
    });

    it("approvals checks are false if no approval was made", async () => {
      const looksrare = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user1, mocks.addresses);
      const { isCurrencyApproved } = await looksrare.createMakerBid(baseMakerBidInput);
  
      expect(isCurrencyApproved).to.be.false;
  
      await looksrare.approveErc20(looksrare.addresses.WETH);
      const valueApproved = await allowance(
        ethers.provider,
        mocks.addresses.WETH,
        signers.user1.address,
        mocks.addresses.EXCHANGE
      );
      expect(valueApproved.eq(constants.MaxUint256)).to.be.true;
    });

    it("approval checks are true if approval were made", async () => {
      const looksrare = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user1, mocks.addresses);
      const tx = await looksrare.approveErc20(looksrare.addresses.WETH);
      await tx.wait();
      const { isCurrencyApproved } = await looksrare.createMakerBid(baseMakerBidInput);
      expect(isCurrencyApproved).to.be.true;
    });

    it("create a simple maker bid with default values", async () => {
      const looksrare = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user1, mocks.addresses);
      const output = await looksrare.createMakerBid(baseMakerBidInput);
      const makerOrder: MakerOrder = {
        isOrderAsk: false,
        signer: signers.user1.address,
        collection: mocks.contracts.collectionERC721.address,
        price: utils.parseEther("1"),
        tokenId: 0,
        amount: 1,
        strategy: mocks.contracts.strategyStandardSaleForFixedPrice.address,
        currency: mocks.contracts.weth.address,
        nonce: 0,
        startTime: Math.floor(Date.now() / 1000),
        endTime: Math.floor(Date.now() / 1000) + 3600,
        minPercentageToAsk: 0,
        params: "0x"
      };
      expect(output.maker).to.eql(makerOrder);
    });

    it("create a simple maker bid with non default values", async () => {
      const looksrare = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user1, mocks.addresses);
      const input = {
        ...baseMakerBidInput,
        amount: 2,
        currency: mocks.contracts.usdt.address,
        startTime: Math.floor(Date.now() / 1000),
        taker: signers.user2.address,
        params: [],
      };
      const output = await looksrare.createMakerBid(input);
      const makerOrder: MakerOrder = {
        isOrderAsk: false,
        signer: signers.user1.address,
        collection: mocks.contracts.collectionERC721.address,
        price: utils.parseEther("1"),
        tokenId: 0,
        amount: 2,
        strategy: mocks.contracts.strategyStandardSaleForFixedPrice.address,
        currency: mocks.contracts.usdt.address,
        nonce: 0,
        startTime: Math.floor(Date.now() / 1000),
        endTime: Math.floor(Date.now() / 1000) + 3600,
        minPercentageToAsk: 0,
        params: "0x"
      };
      expect(output.maker).to.eql(makerOrder);
    });
  });
  
  describe("createTaker", () => {
    let baseMakerAskInput: CreateMakerInput;

    beforeEach(() => {
      baseMakerAskInput = {
        collection: mocks.contracts.collectionERC721.address,
        price: utils.parseEther("1"),
        tokenId: 0,
        strategy: mocks.contracts.strategyStandardSaleForFixedPrice.address,
        nonce: 0,
        endTime: Math.floor(Date.now() / 1000) + 3600,
        minPercentageToAsk: 0,
      }
    })

    it("create taker with recipient", async () => {
      const looksrare = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user1, mocks.addresses);
      const { maker } = await looksrare.createMakerAsk(baseMakerAskInput);
      const taker = looksrare.createTaker(maker, { taker: signers.user2.address });

      const takerOrder: TakerOrder = {
        isOrderAsk: false,
        taker: signers.user2.address,
        price: utils.parseEther("1"),
        tokenId: 0,
        minPercentageToAsk: 0,
        params: "0x"
      }
      expect(taker).to.eql(takerOrder)
    });
    
  });

  describe("signMakerOrder", () => {
    const faultySignature =
"0xcafe829116da9a4b31a958aa790682228b85e5d03b1ae7bb15f8ce4c8432a20813934991833da8e913894c9f35f1f018948c58d68fb61bbca0e07bd43c4492fa2b";
    let domain: TypedDataDomain;
    beforeEach(async () => {

    domain = {
      name: "LooksRareExchange",
      version: "1",
      chainId: SupportedChainId.HARDHAT,
      verifyingContract: mocks.addresses.EXCHANGE,
    };
      
  });
  describe("Sign single maker orders", () => {
    it("sign maker ask order", async () => {
      const lr = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user1, mocks.addresses);

      const makerOrder: MakerOrder = {
        isOrderAsk: true,
        signer: signers.user1.address,
        collection: mocks.contracts.collectionERC721.address,
        price: utils.parseEther("1"),
        tokenId: 0,
        amount: 1,
        strategy: mocks.contracts.strategyStandardSaleForFixedPrice.address,
        currency: mocks.contracts.weth.address,
        nonce: 0,
        startTime: Math.floor(Date.now() / 1000),
        endTime: Math.floor(Date.now() / 1000) + 3600,
        minPercentageToAsk: 0,
        params: "0x"
      };

      const signature = await lr.signMakerOrder(makerOrder);

      expect(utils.verifyTypedData(domain, makerTypes, makerOrder, signature)).to.equal(signers.user1.address);
      let result = ethers.utils.splitSignature(signature);
      const makerOrderWithSignature = {
        ...makerOrder,
        r: result.r,
        v: result.v,
        s: result.s
      }
      expect(await mocks.contracts.orderValidatorV1.checkValiditySignature(makerOrderWithSignature)).to.eql(BigNumber.from(0));

      result = ethers.utils.splitSignature(faultySignature);
      const makerOrderWithFaultySignature = {
        ...makerOrder,
        r: result.r,
        v: result.v,
        s: result.s
      }
      expect(await mocks.contracts.orderValidatorV1.checkValiditySignature(makerOrderWithFaultySignature)).to.eql(BigNumber.from(OrderValidatorEnum.INVALID_V_PARAMETER_EOA));
    });

    it("sign maker bid order", async () => {
      const lr = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user1, mocks.addresses);

      const makerOrder: MakerOrder = {
        isOrderAsk: false,
        signer: signers.user1.address,
        collection: mocks.contracts.collectionERC721.address,
        price: utils.parseEther("1"),
        tokenId: 0,
        amount: 1,
        strategy: mocks.contracts.strategyStandardSaleForFixedPrice.address,
        currency: mocks.contracts.weth.address,
        nonce: 0,
        startTime: Math.floor(Date.now() / 1000),
        endTime: Math.floor(Date.now() / 1000) + 3600,
        minPercentageToAsk: 0,
        params: "0x"
      };

      const signature = await lr.signMakerOrder(makerOrder);

      expect(utils.verifyTypedData(domain, makerTypes, makerOrder, signature)).to.equal(signers.user1.address);
      let result = ethers.utils.splitSignature(signature);
      const makerOrderWithSignature = {
        ...makerOrder,
        r: result.r,
        v: result.v,
        s: result.s
      }
      expect(await mocks.contracts.orderValidatorV1.checkValiditySignature(makerOrderWithSignature)).to.eql(BigNumber.from(0));

      result = ethers.utils.splitSignature(faultySignature);
      const makerOrderWithFaultySignature = {
        ...makerOrder,
        r: result.r,
        v: result.v,
        s: result.s
      }
      expect(await mocks.contracts.orderValidatorV1.checkValiditySignature(makerOrderWithFaultySignature)).to.eql(BigNumber.from(OrderValidatorEnum.INVALID_V_PARAMETER_EOA));
    });
  });
  });

  describe("executeOrder", () => {
    let baseMakerAskInput: CreateMakerInput;

    beforeEach(() => {
      baseMakerAskInput = {
        collection: mocks.contracts.collectionERC721.address,
        price: utils.parseEther("1"),
        tokenId: 0,
        strategy: mocks.contracts.strategyStandardSaleForFixedPrice.address,
        nonce: 0,
        endTime: Math.floor(Date.now() / 1000) + 3600,
        minPercentageToAsk: 0,
      }
    })

    it("execute maker ask and taker bid using ETH", async () => {
      const lrUser1 = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user1, mocks.addresses);
      const lrUser2 = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user2, mocks.addresses);
      
      const { maker } = await lrUser1.createMakerAsk(baseMakerAskInput);
      const signature = await lrUser1.signMakerOrder(maker);

      const taker = lrUser2.createTaker(maker, { taker: signers.user2.address })
      
      let tx = await lrUser1.approveAllCollectionItems(maker.collection);
      await tx.wait();
      const contractMethods = lrUser2.executeOrder(maker, taker, signature, { value: utils.parseEther("1") });
      
      const estimatedGas = await contractMethods.estimateGas();
      expect(estimatedGas.toNumber()).to.be.greaterThan(0);

      await expect(contractMethods.callStatic()).to.eventually.be.fulfilled;

      tx = await contractMethods.call();
      const receipt = await tx.wait();
      expect(receipt.status).to.be.equal(1);
    })

    it("execute maker ask and taker bid using ETH + WETH", async () => {
      const lrUser1 = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user1, mocks.addresses);
      const lrUser2 = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user2, mocks.addresses);
      
      const { maker } = await lrUser1.createMakerAsk(baseMakerAskInput);
      const signature = await lrUser1.signMakerOrder(maker);

      const taker = lrUser2.createTaker(maker, { taker: signers.user2.address })
      
      let tx = await lrUser1.approveAllCollectionItems(maker.collection);
      await tx.wait();

      tx = await lrUser2.approveErc20(lrUser2.addresses.WETH);
      await tx.wait();

      const contractMethods = lrUser2.executeOrder(maker, taker, signature, { value: utils.parseEther("0.5") });
      
      const estimatedGas = await contractMethods.estimateGas();
      expect(estimatedGas.toNumber()).to.be.greaterThan(0);

      await expect(contractMethods.callStatic()).to.eventually.be.fulfilled;

      tx = await contractMethods.call();
      const receipt = await tx.wait();
      expect(receipt.status).to.be.equal(1);
    })

    it("execute maker ask and taker bid using ERC20", async () => {
      const input = {
        ...baseMakerAskInput,
        currency: mocks.contracts.usdt.address
      }
      const lrUser1 = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user1, mocks.addresses);
      const lrUser2 = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user2, mocks.addresses);
      
      const { maker } = await lrUser1.createMakerAsk(input);
      const signature = await lrUser1.signMakerOrder(maker);

      const taker = lrUser2.createTaker(maker, { taker: signers.user2.address })
      let tx = await lrUser1.approveAllCollectionItems(maker.collection);
      await tx.wait();

      tx = await lrUser2.approveErc20(mocks.contracts.usdt.address);
      await tx.wait();

      const contractMethods = lrUser2.executeOrder(maker, taker, signature);
      
      const estimatedGas = await contractMethods.estimateGas();
      expect(estimatedGas.toNumber()).to.be.greaterThan(0);

      await expect(contractMethods.callStatic()).to.eventually.be.fulfilled;

      tx = await contractMethods.call();
      const receipt = await tx.wait();
      expect(receipt.status).to.be.equal(1);
    })

    it("execute maker bid and taker ask using WETH", async () => {
      const lrUser1 = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user1, mocks.addresses);
      const lrUser2 = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user2, mocks.addresses);
      
      const { maker } = await lrUser2.createMakerBid(baseMakerAskInput);
      const signature = await lrUser2.signMakerOrder(maker);

      const taker = lrUser1.createTaker(maker, { taker: signers.user1.address })
      let tx = await lrUser1.approveAllCollectionItems(maker.collection);
      await tx.wait();

      tx = await lrUser2.approveErc20(mocks.contracts.weth.address);
      await tx.wait();

      const contractMethods = lrUser1.executeOrder(maker, taker, signature);
      
      const estimatedGas = await contractMethods.estimateGas();
      expect(estimatedGas.toNumber()).to.be.greaterThan(0);

      await expect(contractMethods.callStatic()).to.eventually.be.fulfilled;

      tx = await contractMethods.call();
      const receipt = await tx.wait();
      expect(receipt.status).to.be.equal(1);
    })

    it("execute maker bid and taker ask using ERC20", async () => {
      const input = {
        ...baseMakerAskInput,
        currency: mocks.contracts.usdt.address
      }
      const lrUser1 = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user1, mocks.addresses);
      const lrUser2 = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user2, mocks.addresses);
      
      const { maker } = await lrUser2.createMakerBid(input);
      const signature = await lrUser2.signMakerOrder(maker);

      const taker = lrUser1.createTaker(maker, { taker: signers.user1.address })
      let tx = await lrUser1.approveAllCollectionItems(maker.collection);
      await tx.wait();

      tx = await lrUser2.approveErc20(mocks.contracts.usdt.address);
      await tx.wait();

      const contractMethods = lrUser1.executeOrder(maker, taker, signature);
      
      const estimatedGas = await contractMethods.estimateGas();
      expect(estimatedGas.toNumber()).to.be.greaterThan(0);

      await expect(contractMethods.callStatic()).to.eventually.be.fulfilled;

      tx = await contractMethods.call();
      const receipt = await tx.wait();
      expect(receipt.status).to.be.equal(1);
    })
  })

  describe("cancelAllOrdersForSender", () => {
    let baseMakerAskInput: CreateMakerInput;

    beforeEach(() => {
      baseMakerAskInput = {
        collection: mocks.contracts.collectionERC721.address,
        price: utils.parseEther("1"),
        tokenId: 0,
        strategy: mocks.contracts.strategyStandardSaleForFixedPrice.address,
        nonce: 0,
        endTime: Math.floor(Date.now() / 1000) + 3600,
        minPercentageToAsk: 0,
      }
    })

    it("cancel all maker order for user", async () => {
      const lrUser1 = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user1, mocks.addresses);
      const lrUser2 = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user2, mocks.addresses);

      // order 1
      const { maker: maker1 } = await lrUser1.createMakerAsk(baseMakerAskInput);
      const signature1 = await lrUser1.signMakerOrder(maker1);

      const taker1 = lrUser2.createTaker(maker1, { taker: signers.user2.address })

      let tx = await lrUser1.approveAllCollectionItems(maker1.collection);
      await tx.wait();
      const contractMethods1 = lrUser2.executeOrder(maker1, taker1, signature1, { value: utils.parseEther("1") });
      
      const estimatedGas = await contractMethods1.estimateGas();
      expect(estimatedGas.toNumber()).to.be.greaterThan(0);

      await expect(contractMethods1.callStatic()).to.eventually.be.fulfilled;
      // order 2
      const { maker: maker2 } = await lrUser1.createMakerAsk({ ...baseMakerAskInput, tokenId: 1, nonce: 1 });
      const signature2 = await lrUser1.signMakerOrder(maker2);

      const taker2 = lrUser2.createTaker(maker2, { taker: signers.user2.address })

      const contractMethods2 = lrUser2.executeOrder(maker2, taker2, signature2, { value: utils.parseEther("1") });
      
      const estimatedGas2 = await contractMethods2.estimateGas();
      expect(estimatedGas2.toNumber()).to.be.greaterThan(0);

      await expect(contractMethods2.callStatic()).to.eventually.be.fulfilled;

      // cancel
      tx = await lrUser1.cancelAllOrdersForSender(2).call();
      await tx.wait()

      // rejected
      await expect(contractMethods2.callStatic()).to.eventually.be.rejected;
      await expect(contractMethods1.callStatic()).to.eventually.be.rejected;
    })
  })

  describe("cancelMultipleMakerOrders", () => {
    let baseMakerAskInput: CreateMakerInput;

    beforeEach(() => {
      baseMakerAskInput = {
        collection: mocks.contracts.collectionERC721.address,
        price: utils.parseEther("1"),
        tokenId: 0,
        strategy: mocks.contracts.strategyStandardSaleForFixedPrice.address,
        nonce: 0,
        endTime: Math.floor(Date.now() / 1000) + 3600,
        minPercentageToAsk: 0,
      }
    })

    it("cancel multiples maker order by nonces", async () => {
      const lrUser1 = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user1, mocks.addresses);
      const lrUser2 = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user2, mocks.addresses);

      // order 1
      const { maker: maker1 } = await lrUser1.createMakerAsk(baseMakerAskInput);
      const signature1 = await lrUser1.signMakerOrder(maker1);

      const taker1 = lrUser2.createTaker(maker1, { taker: signers.user2.address })

      let tx = await lrUser1.approveAllCollectionItems(maker1.collection);
      await tx.wait();
      const contractMethods1 = lrUser2.executeOrder(maker1, taker1, signature1, { value: utils.parseEther("1") });
      
      const estimatedGas = await contractMethods1.estimateGas();
      expect(estimatedGas.toNumber()).to.be.greaterThan(0);

      await expect(contractMethods1.callStatic()).to.eventually.be.fulfilled;
      // order 2
      const { maker: maker2 } = await lrUser1.createMakerAsk({ ...baseMakerAskInput, tokenId: 1, nonce: 1 });
      const signature2 = await lrUser1.signMakerOrder(maker2);

      const taker2 = lrUser2.createTaker(maker2, { taker: signers.user2.address })

      const contractMethods2 = lrUser2.executeOrder(maker2, taker2, signature2, { value: utils.parseEther("1") });
      
      const estimatedGas2 = await contractMethods2.estimateGas();
      expect(estimatedGas2.toNumber()).to.be.greaterThan(0);

      await expect(contractMethods2.callStatic()).to.eventually.be.fulfilled;

      // cancel
      tx = await lrUser1.cancelMultipleMakerOrders([0, 1]).call();
      await tx.wait()

      // rejected
      await expect(contractMethods2.callStatic()).to.eventually.be.rejected;
      await expect(contractMethods1.callStatic()).to.eventually.be.rejected;
    })
  })

  describe("verifyMakerOrder", () => {
    let baseMakerInput: CreateMakerInput;

    beforeEach(() => {
      baseMakerInput = {
        collection: mocks.contracts.collectionERC721.address,
        price: utils.parseEther("1"),
        tokenId: 0,
        strategy: mocks.contracts.strategyStandardSaleForFixedPrice.address,
        nonce: 0,
        endTime: Math.floor(Date.now() / 1000) + 3600,
        minPercentageToAsk: 0,
      }
    })

    it("verify maker ask orders", async () => {
      const lr = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user1, mocks.addresses);
      const { maker } = await lr.createMakerAsk(baseMakerInput);
      const signature = await lr.signMakerOrder(maker);
  
      let codes = await lr.verifyMakerOrder(maker, signature);
      expect(codes.some(code => code === OrderValidatorEnum.ERC721_NO_APPROVAL_FOR_ALL_OR_TOKEN_ID)).to.be.true;
  
      const tx = await lr.approveAllCollectionItems(baseMakerInput.collection);
      await tx.wait();
  
      codes = await lr.verifyMakerOrder(maker, signature);
      expect(codes.every(code => code === OrderValidatorEnum.ORDER_EXPECTED_TO_BE_VALID)).to.be.true;
    });

    it("verify maker bid orders", async () => {
      const lr = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user1, mocks.addresses);
      const { maker } = await lr.createMakerBid(baseMakerInput);
      const signature = await lr.signMakerOrder(maker);
  
      let codes = await lr.verifyMakerOrder(maker, signature);
      expect(codes.some(code => code === OrderValidatorEnum.ERC20_APPROVAL_INFERIOR_TO_PRICE)).to.be.true;
  
      const tx = await lr.approveErc20(lr.addresses.WETH);
      await tx.wait();
  
      codes = await lr.verifyMakerOrder(maker, signature);
      expect(codes.every(code => code === OrderValidatorEnum.ORDER_EXPECTED_TO_BE_VALID)).to.be.true;
    });
  })

  describe("verifyMakerOrders", () => {
    let baseMakerInput: CreateMakerInput;

    beforeEach(() => {
      baseMakerInput = {
        collection: mocks.contracts.collectionERC721.address,
        price: utils.parseEther("1"),
        tokenId: 0,
        strategy: mocks.contracts.strategyStandardSaleForFixedPrice.address,
        nonce: 0,
        endTime: Math.floor(Date.now() / 1000) + 3600,
        minPercentageToAsk: 0,
      }
    })

    it("verify maker orders", async () => {
      const lr = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user1, mocks.addresses);
      const { maker: maker1 } = await lr.createMakerAsk(baseMakerInput);
      const signature1 = await lr.signMakerOrder(maker1);
      const { maker: maker2 } = await lr.createMakerBid(baseMakerInput);
      const signature2 = await lr.signMakerOrder(maker2);
  
      let orders = await lr.verifyMakerOrders([maker1, maker2], [signature1, signature2]);
      expect(orders[0].some((code) => code === OrderValidatorEnum.ERC721_NO_APPROVAL_FOR_ALL_OR_TOKEN_ID)).to.be.true;
  
      let tx = await lr.approveAllCollectionItems(baseMakerInput.collection);
      await tx.wait();
      tx = await lr.approveErc20(lr.addresses.WETH);
      await tx.wait();
  
      orders = await lr.verifyMakerOrders([maker1, maker2], [signature1, signature2]);
      expect(orders[0].every((code) => code === OrderValidatorEnum.ORDER_EXPECTED_TO_BE_VALID)).to.be.true;
    });
  })

  describe("createMakerCollectionOffer", () => {
    let baseMakerCollectionInput: CreateMakerCollectionOfferInput;

    beforeEach(async () => {
      baseMakerCollectionInput = {
        collection: mocks.contracts.collectionERC721.address,
        price: utils.parseEther("1"),
        nonce: 0,
        endTime: Math.floor(Date.now() / 1000) + 3600,
        minPercentageToAsk: 0,
      }
    });

    it("create maker collection offer with wrong time format", async () => {
      const looksrare = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user1, mocks.addresses);
      await expect(looksrare.createMakerCollectionOffer({ ...baseMakerCollectionInput, startTime: Date.now() })).to.eventually.be.rejectedWith(
        ErrorTimestamp
      );
      await expect(looksrare.createMakerCollectionOffer({ ...baseMakerCollectionInput, endTime: Date.now() })).to.eventually.be.rejectedWith(
        ErrorTimestamp
      );
    });

    it("approvals checks are false if no approval was made", async () => {
      const looksrare = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user1, mocks.addresses);
      const { isCurrencyApproved } = await looksrare.createMakerCollectionOffer(baseMakerCollectionInput);
  
      expect(isCurrencyApproved).to.be.false;
  
      await looksrare.approveErc20(looksrare.addresses.WETH);
      const valueApproved = await allowance(
        ethers.provider,
        mocks.addresses.WETH,
        signers.user1.address,
        mocks.addresses.EXCHANGE
      );
      expect(valueApproved.eq(constants.MaxUint256)).to.be.true;
    });

    it("approval checks are true if approval were made", async () => {
      const looksrare = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user1, mocks.addresses);
      const tx = await looksrare.approveErc20(looksrare.addresses.WETH);
      await tx.wait();
      const { isCurrencyApproved } = await looksrare.createMakerCollectionOffer(baseMakerCollectionInput);
      expect(isCurrencyApproved).to.be.true;
    });

    it("create a simple maker collection offer with default values", async () => {
      const looksrare = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user1, mocks.addresses);
      const output = await looksrare.createMakerCollectionOffer(baseMakerCollectionInput);
      const makerOrder: MakerOrder = {
        isOrderAsk: false,
        signer: signers.user1.address,
        collection: mocks.contracts.collectionERC721.address,
        price: utils.parseEther("1"),
        tokenId: constants.Zero,
        amount: 1,
        strategy: mocks.contracts.strategyAnyItemFromCollectionForFixedPrice.address,
        currency: mocks.contracts.weth.address,
        nonce: 0,
        startTime: Math.floor(Date.now() / 1000),
        endTime: Math.floor(Date.now() / 1000) + 3600,
        minPercentageToAsk: 0,
        params: "0x"
      };
      expect(output.maker).to.eql(makerOrder);
    });

    it("create a simple maker collection offer with non default values", async () => {
      const looksrare = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user1, mocks.addresses);
      const input = {
        ...baseMakerCollectionInput,
        amount: 2,
        currency: mocks.contracts.usdt.address,
        startTime: Math.floor(Date.now() / 1000),
        taker: signers.user2.address,
        params: [],
      };
      const output = await looksrare.createMakerCollectionOffer(input);
      const makerOrder: MakerOrder = {
        isOrderAsk: false,
        signer: signers.user1.address,
        collection: mocks.contracts.collectionERC721.address,
        price: utils.parseEther("1"),
        tokenId: constants.Zero,
        amount: 2,
        strategy: mocks.contracts.strategyAnyItemFromCollectionForFixedPrice.address,
        currency: mocks.contracts.usdt.address,
        nonce: 0,
        startTime: Math.floor(Date.now() / 1000),
        endTime: Math.floor(Date.now() / 1000) + 3600,
        minPercentageToAsk: 0,
        params: "0x"
      };
      expect(output.maker).to.eql(makerOrder);
    });
  });

  describe("createTakerCollectionOffer", () => {
    let baseMakerCollectionInput: CreateMakerCollectionOfferInput;

    beforeEach(async () => {
      baseMakerCollectionInput = {
        collection: mocks.contracts.collectionERC721.address,
        price: utils.parseEther("1"),
        nonce: 0,
        endTime: Math.floor(Date.now() / 1000) + 3600,
        minPercentageToAsk: 0,
      }
    });

    it("create taker collection offer with recipient", async () => {
      const looksrare = new LooksRare(SupportedChainId.HARDHAT, ethers.provider, signers.user1, mocks.addresses);
      const { maker } = await looksrare.createMakerCollectionOffer(baseMakerCollectionInput);
      const taker = looksrare.createTakerCollectionOffer(maker, 1, { taker: signers.user2.address });

      const takerOrder: TakerOrder = {
        isOrderAsk: true,
        taker: signers.user2.address,
        price: utils.parseEther("1"),
        tokenId: 1,
        minPercentageToAsk: 0,
        params: "0x"
      }
      expect(taker).to.eql(takerOrder)
    });
    
  });
})