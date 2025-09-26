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
        const [deployer,user1, user2, user3] = await ethers.getSigners();
        console.log("部署者地址:", deployer.address);
        console.log("user1地址:", user1.address);
        console.log("user2地址:", user2.address);
        console.log("user3地址:", user3.address);
        
        // 3. 获取部署的合约实例
        // NFT 合约
        const nftDeployment = await deployments.get("NFT");
        const nftContract = await ethers.getContractAt("NFT", nftDeployment.address);
        console.log("NFT 实现合约地址:", nftDeployment.address);

        const priceOracleDeployment = await deployments.get("PriceOracle");
        const priceOracleAddress = priceOracleDeployment.address; // 这才是正确的预言机地址
        const priceOracleContract = await ethers.getContractAt("PriceOracle", priceOracleAddress);
        console.log("PriceOracle 合约地址:", priceOracleAddress);

        // Auction合约
        const auctionDeployment = await deployments.get("Auction");
        const auctionContract = await ethers.getContractAt("Auction", auctionDeployment.address);
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
        let auctionAddress;
        // 查找并解析目标事件
        const auctionCreatedEvent = receipt.logs
            .map(log => {
                try {
                    return auctionFactory.interface.parseLog(log);
                } catch (e) {
                    return null;
                }
            })
            .find(parsedLog => parsedLog && parsedLog.name === "AuctionCreated");

        if (auctionCreatedEvent) {
            auctionAddress = auctionCreatedEvent.args.auctionAddress;
            console.log("拍卖创建成功，地址为:", auctionAddress);
        } else {
            console.log("未找到AuctionCreated事件");
        }

        await nftContract.approve(auctionAddress, tokenId);
        console.log("授权成功");
        //获取当前实例
        const auctionInstance = await ethers.getContractAt("Auction", auctionAddress);
        const tx = await auctionInstance.startAuction(tokenId);
        await tx.wait();
        console.log(123);
        console.log("拍卖状态:", await auctionInstance.getStatus());
        //竞价...
        const bidAmount = ethers.parseEther("0.02"); // 0.02 ETH
        priceOracleContract.addPriceFeed(ethers.ZeroAddress,"0x694AA1769357215DE4FAC081bf1f309aDC325306");

        await auctionInstance.connect(user1).bid(
            bidAmount,
            ethers.ZeroAddress,
            { value: bidAmount }
        );
        //等待60s
        await time.increase(3600);
        //结束拍卖
        const a = await auctionInstance.endAuction();
        await a.wait();
        console.log("拍卖状态:", await auctionInstance.getStatus());
        console.log("拍卖工厂allAuctions0:", await auctionFactory.allAuctions(0));

        //检查NFT是否被转移
        const owner = await nftContract.ownerOf(tokenId);
        console.log("NFT当前地址是否为User1:",owner == user1.address,);
        console.log("开始升级Auction合约");
        await deployments.fixture(["upgradeAuctionV2"]);
        console.log("开始升级AuctionFactory合约");
        await deployments.fixture(["upgradeAuctionFactoryV2"]);
        
        console.log("拍卖状态:", await auctionInstance.getStatus());
        console.log("拍卖工厂allAuctions0:", await auctionFactory.allAuctions(0));

    });
});