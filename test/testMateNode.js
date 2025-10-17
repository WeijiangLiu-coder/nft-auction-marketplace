const { expect } = require("chai");
const { loadFixture, mine  } = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const hre = require("hardhat");
const { parseEther,formatEther } = require("viem");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("MateNode", function () {
    //loadFixture 的核心作用是为每个测试用例 (it 块) 创建一个干净、隔离的环境
    async function deployFixture() {
         // 获取公共客户端
        const publicClient = await hre.viem.getPublicClient();
       // 1. 部署 MetaNode 代币合约（Viem 直接返回已部署实例）
        const MetaNode = await hre.viem.deployContract("MetaNodeToken");
        const metaNodeAddress = MetaNode.address; // 直接从实例拿地址，无需多余步骤
        const [deployer, user1, user2, user3] = await hre.viem.getWalletClients();
        
        const startBlock = (await publicClient.getBlockNumber());
        const endBlock = startBlock + 9000n;
        const MetaNodePerBlock = 100n;
        console.log("MetaNode deployed to:", metaNodeAddress);

        const MetaNodeStake = await hre.viem.deployContract("MetaNodeStake"); 
        // 关键：获取加载了本地测试账户的 WalletClient（含私钥）
        
        console.log("initialize startBlock:", startBlock);
        console.log("initialize endBlock:", endBlock);
        
        await MetaNodeStake.write.initialize([
            metaNodeAddress,
            startBlock,
            endBlock,
            MetaNodePerBlock,
        ],
        {
          account: deployer.account
        }
        );

        console.log(`准备为 user1 (${user1.account.address}) 设置 10000 ETH 余额`);
        const amountToSet = parseEther("10000");
        await hre.network.provider.request({
            method: "hardhat_setBalance",
            params: [
                user1.account.address,
                "0x" + amountToSet.toString(16) // 转换为十六进制格式（Hardhat 要求
            ],
        });
        const user1Balance = await publicClient.getBalance({ address: user1.account.address });
        console.log(`user1 当前余额: ${formatEther(user1Balance)} ETH`);
        await hre.network.provider.request({
            method: "hardhat_setBalance",
            params: [
                user2.account.address,
                "0x" + amountToSet.toString(16) // 转换为十六进制格式（Hardhat 要求
            ],
        });
        await hre.network.provider.request({
            method: "hardhat_setBalance",
            params: [
                user3.account.address,
                "0x" + amountToSet.toString(16) // 转换为十六进制格式（Hardhat 要求
            ],
        });


        return { 
            MetaNode,
            MetaNodeStake,
            publicClient,
            metaNodeAddress,
            startBlock, 
            endBlock,
            MetaNodePerBlock,
            deployer,
            user1,
            user2,
            user3,
        };
    }
      // 示例测试用例：验证初始化状态
    it("验证初始化状态", async function () {
        const { MetaNodeStake, MetaNode, startBlock, endBlock, MetaNodePerBlock } =
        await loadFixture(deployFixture);

        // 验证 MetaNode 地址
        const actualMetaNodeAddr = await MetaNodeStake.read.MetaNode(); // 合约返回的地址（可能是校验和格式）
        const expectedMetaNodeAddr = MetaNode.address; // Viem 返回的地址（可能是全小写）
        expect(actualMetaNodeAddr.toLowerCase()).to.equal(expectedMetaNodeAddr.toLowerCase());
        console.log("MetaNode equal");
        // 验证起始/结束区块
        expect(await MetaNodeStake.read.startBlock()).to.equal(startBlock);
        console.log("startBlock equal");
        expect(await MetaNodeStake.read.endBlock()).to.equal(endBlock);
        console.log("endBlock equal");

        // 验证每个区块的奖励
        expect(await MetaNodeStake.read.MetaNodePerBlock()).to.equal(MetaNodePerBlock);
        console.log("MetaNodePerBlock equal");
    });

    it("添加质押池", async function () {
        const { MetaNodeStake,deployer } =
        await loadFixture(deployFixture);
        await MetaNodeStake.write.addPool([
            hre.ethers.ZeroAddress, 
            100n, 
            100n, 
            100n, 
            false
        ],{
            account: deployer.account
        });

        console.log("addPool success");
        const poolLength = await MetaNodeStake.read.poolLength();
        expect(poolLength).to.equal(1n);
    })

    it("用户质押ETH", async function () {
        const { publicClient,MetaNodeStake,deployer,user1,user2,user3 } =
        await loadFixture(deployFixture);

        await MetaNodeStake.write.addPool([
            hre.ethers.ZeroAddress, 
            100n, 
            BigInt(hre.ethers.parseEther("100")), 
            100n, 
            false
        ],{
            account: deployer.account
        });
        console.log("addPool after pool:",await MetaNodeStake.read.pool([0]));

        const user1Stake = BigInt(hre.ethers.parseEther("300")); // 300 ETH → wei
        const user2Stake = BigInt(hre.ethers.parseEther("200")); // 200 ETH → wei
        const user3Stake = BigInt(hre.ethers.parseEther("500")); // 500 ETH → wei
        //用户1 质押300ETH
        await MetaNodeStake.write.depositETH({
            account: user1.account,
            value: user1Stake
        })
        //用户2 质押200ETH
        await MetaNodeStake.write.depositETH({
            account: user2.account,
            value: user2Stake
        })
        console.log("当前区块高度:",await publicClient.getBlockNumber());
        //产生1000个区块
        await mine(1000); // 直接调用 mine 函数，参数为区块数量
        const blockAfterMine = await publicClient.getBlockNumber();
        console.log("生成1000个区块后, 当前区块高度:", blockAfterMine.toString());
        //用户3 质押500ETH
        await MetaNodeStake.write.depositETH({
            account: user3.account,
            value:user3Stake
        })
        
        const deployerStake = await MetaNodeStake.read.stakingBalance([0, deployer.account.address]);
        console.log("deployer 实际质押余额:", deployerStake.toString());
        
        expect(await MetaNodeStake.read.stakingBalance([0, user1.account.address])).to.equal(user1Stake);
        expect(await MetaNodeStake.read.stakingBalance([0, user2.account.address])).to.equal(user2Stake);
        expect(await MetaNodeStake.read.stakingBalance([0, user3.account.address])).to.equal(user3Stake);

        //更新奖励
        console.log("startBlock:",await MetaNodeStake.read.startBlock());
        console.log("endBlock:",await MetaNodeStake.read.endBlock());
        console.log("pool:",await MetaNodeStake.read.pool([0]));
        await MetaNodeStake.write.massUpdatePools();
        const user1Pending = await MetaNodeStake.read.pendingMetaNodeByBlockNumber([0, user1.account.address, blockAfterMine]);
        console.log("user1Pending:", user1Pending.toString());
        expect(user1Pending).to.equal(1000n * 100n * user1Stake / (user1Stake + user2Stake));
        await mine(1000); 
        await MetaNodeStake.write.massUpdatePools();
        const user1Pending2 = await MetaNodeStake.read.pendingMetaNodeByBlockNumber([0, user1.account.address, blockAfterMine]);
        console.log("user1Pending2:", user1Pending2.toString());
        expect(user1Pending2).to.equal(user1Pending + 1000n * 100n * user1Stake / (user1Stake + user2Stake + user3Stake));
    })
})