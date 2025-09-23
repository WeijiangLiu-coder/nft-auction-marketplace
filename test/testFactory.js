const { expect } = require("chai");
const { deployments, ethers} = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Test Auction Factory with hardhat-deploy", function() {
   
    it("Should create auction successfully with hardhat-deploy", async function() {
        
        console.log("加载部署脚本...");
        
        // 2. 使用 fixture 加载部署脚本
        await deployments.fixture(["deployNFT", "deployPriceOracle", "deployAuction", "deployAuctionFactory"]);
        console.log("部署脚本加载完成");
        
        // 2. 获取签名者
        const [deployer] = await ethers.getSigners();
        console.log("部署者地址:", deployer.address);
        
        // 3. 获取部署的合约实例
        // NFT 合约
        const nftDeployment = await deployments.get("NFT");
        const nftContract = await ethers.getContractAt("NFT", nftDeployment.address);
        console.log("NFT 实现合约地址:", nftDeployment.address);

        const priceOracleDeployment = await deployments.get("PriceOracle");
        const priceOracleAddress = priceOracleDeployment.address; // 这才是正确的预言机地址
        console.log("PriceOracle 合约地址:", priceOracleAddress);

        // Auction合约
        const auctionDeployment = await deployments.get("Auction");
        console.log("Auction 实现合约地址:", auctionDeployment.address);
 
        // AuctionFactory 合约
        const auctionFactoryDeployment = await deployments.get("AuctionFactory");
        console.log("AuctionFactory 实现合约地址:", auctionFactoryDeployment.implementation);
        console.log("AuctionFactory 代理合约地址:", auctionFactoryDeployment.address);
        const auctionFactory = await ethers.getContractAt("AuctionFactory", auctionFactoryDeployment.address);
        
    

        // 5. 准备测试参数
        const tokenId = 1;
        const nftContractAddress = nftDeployment.address;
        const paymentToken = ethers.ZeroAddress; // ETH
        const startPrice = ethers.parseEther("0.01");
        const duration = 3600;
        const priceOracle = priceOracleAddress;
        
        // 6.  mint NFT
        await nftContract.mintNFT(deployer.address, "https://gateway.pinata.cloud/ipfs/bafybeieoe7tawci5viqlmcivecqljhxzmyut7v77e7kxduzqlbbdynmoym");
        console.log("成功 mint NFT");
        
        console.log("已授权 AuctionFactory 操作 NFT");
        
        // 8. 尝试创建拍卖
        console.log("开始创建拍卖...");
        // 注意：这里调用的是 factory 的 createAuction 方法
        const createTx = await auctionFactory.createAuction(
            tokenId,          // NFT ID
            nftContractAddress, // NFT 合约地址
            paymentToken,     // 支付代币地址
            startPrice,       // 起拍价
            duration,         // 拍卖时长
            priceOracle       // 预言机地址
        );
        const receipt = await createTx.wait();
        if (receipt.status !== 1) {
            console.error("交易执行失败");
            return; // 终止测试
        }
        console.log("拍卖创建成功", receipt.events);
        const event = receipt.events.find(event => event.event === 'AuctionCreated');
        if (event) {
            const auctionAddress = event.args.auctionAddress;
            console.log('拍卖地址:', auctionAddress);
            //授权
            await nftContract.approve(auctionAddress, tokenId);
            //开始拍卖

            // 9. 验证交易是否成功
            expect(receipt.status).to.equal(1, "交易应该成功");
            console.log("测试通过：使用 hardhat-deploy 成功创建拍卖！");
        } else {
            console.log('未找到事件');
        }
    });
});