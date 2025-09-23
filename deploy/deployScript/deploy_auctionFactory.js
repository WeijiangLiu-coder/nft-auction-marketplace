const { ethers, upgrades } = require("hardhat");

module.exports = async ({ deployments, getNamedAccounts }) => {
  const [deployer] = await ethers.getSigners();
  console.log("部署 AuctionFactory 实现合约的地址:", deployer.address);

  // 1. 先获取已部署的 Auction 实现合约地址（关键！initialize 需要这个参数）
  // 注意：需要先部署 Auction 实现合约，并在 deployments 中保存为 "AuctionImplementation"
  const auctionImpl = await deployments.get("Auction");
  const auctionImplAddress = auctionImpl.address;
  console.log("AuctionFactory部署脚本获取 -> Auction 实现合约地址:", auctionImplAddress);

  const AuctionFactory = await ethers.getContractFactory("AuctionFactory");
  const auctionFactoryProxy = await upgrades.deployProxy(
    AuctionFactory,
    [auctionImplAddress],
    {initializer: "initialize"}
  ); 

  await auctionFactoryProxy.waitForDeployment();
  const factoryProxyAddress = await auctionFactoryProxy.getAddress();
  const factoryImplAddress = await upgrades.erc1967.getImplementationAddress(factoryProxyAddress)
  console.log("AuctionFactory 代理合约地址:", factoryProxyAddress);
  console.log("AuctionFactory 实现合约地址:", factoryImplAddress);

  // 保存工厂合约实例的部署记录（供测试脚本使用）
  await deployments.save("AuctionFactory", {
    abi: AuctionFactory.interface.format("json"),
    address: factoryProxyAddress,
    implementation: factoryImplAddress,
  });
};
module.exports.tags = ["deployAuctionFactory"];