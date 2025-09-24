const { ethers, upgrades } = require("hardhat")
const fs = require("fs")
const path = require("path")

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { save } = deployments
    const { deployer } = await getNamedAccounts()
    console.log("部署用户地址：", deployer)
  
    // 读取 json文件
    const storePath = path.resolve(__dirname, "../.cache/AuctionImplementation.json");
    const storeData = fs.readFileSync(storePath, "utf-8");
    const { abi, address, implementation } = JSON.parse(storeData);
    // 升级版的业务合约
    const Auction = await ethers.getContractFactory("AuctionV2")
    // 升级代理合约（UUPS），不需要调用不存在的 admin 函数
    const AuctionProxy = await upgrades.upgradeProxy(address, Auction)
    await AuctionProxy.waitForDeployment()
    const AuctionAddress = await AuctionProxy.getAddress()
  //   // 保存代理合约地址
  //   fs.writeFileSync(
  //     storePath,
  //     JSON.stringify({
  //       proxyAddress: proxyAddressV2,
  //       implAddress,
  //       abi,
  //     })
  //   );
  
    await save("AuctionV2", {
      abi,
      address: AuctionAddress,
    })
  }
  
  
  module.exports.tags = ["upgradeAuctionV2"]