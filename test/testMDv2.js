const { expect } = require("chai");
const { loadFixture, mine  } = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const hre = require("hardhat");
const {  parseEther, formatEther, zeroAddress } = require("viem");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("MDv2", function () {
    let publicClient;
    let MetaNode;
    let deployer, user1, user2, user3;
    let startBlock;
    let endBlock;
    let MetaNodePerBlock;
    let MetaNodeStake;
    async function deployFixture() {
        // 获取公共客户端
        publicClient = await hre.viem.getPublicClient();
        // 1. 部署 MetaNode 代币合约（Viem 直接返回已部署实例）
        MetaNode = await hre.viem.deployContract("MetaNodeToken");
        // 2. 部署 MetaNodeStake 合约
        MetaNodeStake = await hre.viem.deployContract("MetaNodeStake");

        [deployer, user1, user2, user3] = await hre.viem.getWalletClients();
        startBlock = (await publicClient.getBlockNumber());
        endBlock = startBlock +1000n;
        MetaNodePerBlock = 10n;
        
        //调用MetaNodeStake 初始化函数
        await MetaNodeStake.write.initialize([
            MetaNode.address,
            startBlock,
            endBlock,
            MetaNodePerBlock,
        ],
        {
          account: deployer.account
        });


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
    }
    async function createPool(){
        await MetaNodeStake.write.addPool([
            hre.ethers.ZeroAddress, 
            100n, 
            100n, 
            10n, 
            false
        ],{
            account: deployer.account
        });
    }
    it("正确初始化参数", async function () {
        console.log("正在执行测试1...");
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
        console.log("测试1执行完毕");
    });

    it("错误添加质押池", async function () {
        console.log("正在执行测试2...");
        await loadFixture(deployFixture);
        console.log("添加第一个质押池不是ETH");
        console.log("当前池子的len是:", await MetaNodeStake.read.poolLength());
        await expect(
            MetaNodeStake.write.addPool(
            [
                user1.account.address,
                100n, 
                100n, 
                100n, 
                false
            ],
            { account: deployer.account }
            )
        ).to.be.rejectedWith("first pool to be ETH pool");
        console.log("添加质押池的角色不是admin");
        await expect(
            MetaNodeStake.write.addPool(
            [
                zeroAddress,
                100n, 
                100n, 
                100n, 
                false
            ],
            { account: user1.account }
            )
        ).to.be.rejectedWith(/AccessControl: account/);
        console.log("测试2执行完毕");
    })
    it("正确添加质押池", async function () {
        console.log("正在执行测试3...");
        await loadFixture(deployFixture);
        console.log("添加第一个质押池是ETH");
        await MetaNodeStake.write.addPool([
            hre.ethers.ZeroAddress, 
            100n, 
            100n, 
            10n, 
            false
        ],{
            account: deployer.account
        });
        expect(await MetaNodeStake.read.poolLength()).to.equal(1n);

        console.log("添加第二个质押池是MetaNode");
        await MetaNodeStake.write.addPool([
            MetaNode.address, 
            100n, 
            100n, 
            100n, 
            false
        ],{
            account: deployer.account
        });
        expect(await MetaNodeStake.read.poolLength()).to.equal(2n);
        console.log("测试3执行完毕");
    })

    it("用户质押ETH", async function () {
        console.log("正在执行测试4...");
        await loadFixture(deployFixture);
        await loadFixture(createPool);
        const user1Stake = BigInt(hre.ethers.parseEther("300")); // 300 ETH → wei
        const user2Stake = BigInt(hre.ethers.parseEther("200")); // 200 ETH → wei
        const user3Stake = BigInt(hre.ethers.parseEther("500")); // 500 ETH → wei
        console.log("   当前区块高度为：", await publicClient.getBlockNumber());
        //用户1 质押300ETH
        console.log("   用户1质押300ETH");
        await MetaNodeStake.write.depositETH({
            account: user1.account,
            value: user1Stake
        })
        console.log("   用户2质押200ETH");
        const afterDepositBlockUser1 = await publicClient.getBlockNumber();
        //用户2 质押200ETH
        await MetaNodeStake.write.depositETH({
            account: user2.account,
            value: user2Stake
        })
        const afterDepositBlockUser2 = await publicClient.getBlockNumber();
        console.log("   用户1质押后区块高度:", afterDepositBlockUser1.toString());
        console.log("   用户2质押后区块高度:", afterDepositBlockUser2.toString());
        console.log("   用户1 finishedMetaNode:", (await MetaNodeStake.read.user([0, user1.account.address]))[1].toString());
        console.log("   用户2 finishedMetaNode:", (await MetaNodeStake.read.user([0, user2.account.address]))[1].toString());
        //产生100个区块
        await mine(100);

        const afterFirstMineBlock = await publicClient.getBlockNumber();
        console.log("   第一次挖矿后区块高度:", afterFirstMineBlock.toString());
        console.log("   用户1实际挖矿数量:", (afterFirstMineBlock - afterDepositBlockUser1).toString());
        console.log("   用户2实际挖矿数量:", (afterFirstMineBlock - afterDepositBlockUser2).toString());
        //更新奖励
        await MetaNodeStake.write.massUpdatePools();

        const ETHPoolAfterFirst = await MetaNodeStake.read.pool([0]);
        console.log("   第一次massUpdate后ETH池状态:");
        console.log("   lastRewardBlock:", ETHPoolAfterFirst[2].toString());
        console.log("   accMetaNodePerST:", ETHPoolAfterFirst[3].toString());

        const user1Pending = await MetaNodeStake.read.pendingMetaNode([0, user1.account.address]);
        console.log("   user1Pending:", user1Pending.toString());
        let totalStake = user1Stake + user2Stake;
        expect(user1Pending).to.equal((afterFirstMineBlock - afterDepositBlockUser1) * MetaNodePerBlock * user1Stake / totalStake);


        //用户3 质押500ETH
        await MetaNodeStake.write.depositETH({
            account: user3.account,
            value:user3Stake
        })
        const afterUser3DepositBlock = await publicClient.getBlockNumber();
        console.log("   用户3质押后区块高度:", afterUser3DepositBlock.toString());

        const deployerStake = await MetaNodeStake.read.stakingBalance([0, deployer.account.address]);
        console.log("   deployer 实际质押余额:", deployerStake.toString());
        
        expect(await MetaNodeStake.read.stakingBalance([0, user1.account.address])).to.equal(user1Stake);
        expect(await MetaNodeStake.read.stakingBalance([0, user2.account.address])).to.equal(user2Stake);
        expect(await MetaNodeStake.read.stakingBalance([0, user3.account.address])).to.equal(user3Stake);
    
        await mine(100);
        const afterSecondMineBlock = await publicClient.getBlockNumber();
        console.log("   第二次挖矿后区块高度:", afterSecondMineBlock.toString());
        console.log("   实际挖矿数量:", (afterSecondMineBlock - afterUser3DepositBlock).toString());

        //更新奖励 
        await MetaNodeStake.write.massUpdatePools();

        const ETHPoolAfterSecond = await MetaNodeStake.read.pool([0]);
        console.log("   第二次massUpdate后ETH池状态:");
        console.log("   lastRewardBlock:", ETHPoolAfterSecond[2].toString()); // 应等于afterSecondMineBlock
        console.log("   accMetaNodePerST:", ETHPoolAfterSecond[3].toString());

        console.log("   user1的信息:", await MetaNodeStake.read.user([0,user1.account.address]));

        const user1Pending2 = await MetaNodeStake.read.pendingMetaNode([0, user1.account.address]);
        console.log("   user1Pending2:", user1Pending2.toString());
        expect(user1Pending2).to.equal(300n + 150n);

        //用户1 质押500ETH
        await MetaNodeStake.write.depositETH({
            account: user1.account,
            value: user3Stake
        })
        await mine(100);
        await MetaNodeStake.write.massUpdatePools();
        const user1Pending3 = await MetaNodeStake.read.pendingMetaNode([0, user1.account.address]);
        console.log("   user1Pending2:", user1Pending2.toString());
        expect(user1Pending3).to.equal(300n + 150n + 267n);

        console.log("测试4执行完毕");
    })

    it("用户1提取奖励", async function () {
        console.log("正在执行测试5...");
        await loadFixture(deployFixture);
        await MetaNode.write.transfer([MetaNodeStake.address, 2000n],{account: deployer.account})
        
        await MetaNodeStake.write.pauseClaim({account: deployer.account})
        await expect(
            MetaNodeStake.write.claim([0],{account: user1.account})
        ).to.be.rejectedWith(/claim/);
        await MetaNodeStake.write.unpauseClaim({account: deployer.account})
        await MetaNodeStake.write.claim([0],{account: user1.account})

        const user1Meta = await MetaNode.read.balanceOf([user1.account.address]);
        expect(user1Meta).to.equal(450n);
        const afterTransfer =  await MetaNodeStake.read.user([0,user1.account.address]);
        expect(afterTransfer[1]).to.equal(450n);
        console.log("测试5执行完毕");
    })

    it("用户1提取质押", async function () {
        console.log("正在执行测试6...");
        await loadFixture(deployFixture);
        await MetaNodeStake.write.pauseWithdraw({account: deployer.account})
        await expect(
            MetaNodeStake.write.unstake([0, BigInt(hre.ethers.parseEther("300"))],{account: deployer.account})
        ).to.be.rejectedWith(/withdraw/);

        await MetaNodeStake.write.unpauseWithdraw({account: deployer.account})
        await MetaNodeStake.write.unstake([0, BigInt(hre.ethers.parseEther("300"))],{account: user1.account})
        const [requestAmount,pendingWithdrawAmount] = await MetaNodeStake.read.withdrawAmount([0, user1.account.address])
        console.log("requestAmount",requestAmount.toString());
        console.log("pendingWithdrawAmount",pendingWithdrawAmount.toString());
        
        await mine(100)

        await MetaNodeStake.write.withdraw([0],{account: user1.account})
        expect(await MetaNodeStake.read.stakingBalance([0, user1.account.address])).to.equal(0n);
        console.log("测试6执行完毕");
    })
})