const { ethers } = require("hardhat");

module.exports = async ({ deployments, getNamedAccounts }) => {
  
  const [deployer] = await ethers.getSigners();
  console.log("部署 Auction 账户的地址:", deployer.address);

  const Auction = await ethers.getContractFactory("Auction");
  const CCIP_ROUTER_MOCK_ADDRESS = "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199";
  //合约部署
  const auction = await Auction.deploy(CCIP_ROUTER_MOCK_ADDRESS);
  await auction.waitForDeployment();
  const auctionAddress = await auction.getAddress();
  //const auctionImplAddress = await upgrades.erc1967.getImplementationAddress(auctionProxyAddress)
  console.log("Auction 实现合约地址:", auctionAddress);
  console.log("Auction 部署完成");

  // 保存实现合约地址到部署记录（方便后续 Factory 调用）
  await deployments.save("Auction", {
    abi: Auction.interface.format("json"),
    address: auctionAddress,
  });
};
module.exports.tags = ["deployAuction"];