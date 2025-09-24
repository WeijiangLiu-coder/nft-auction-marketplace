const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

module.exports = async ({ deployments, getNamedAccounts }) => {
  // 使用 getNamedAccounts 获取部署者地址，这是 hardhat-deploy 的标准做法
  const { deployer } = await getNamedAccounts();
  const signer = await ethers.getSigner(deployer);
  console.log("部署 Auction 账户的地址:", signer.address);

  const Auction = await ethers.getContractFactory("Auction", signer);

  // 准备传递给 initialize 函数的参数
  const initParams = [
    3600,                           // _duration: 1 hour (示例值)
    ethers.parseEther("0.1"),       // _startPrice: 0.1 ETH (示例值)
    ethers.ZeroAddress,             // _nftContract: 部署后设置
    0,                              // _tokenId: 部署后设置
    deployer,                       // _realOwner: 拍卖的所有者
    ethers.ZeroAddress,             // _priceOracle: 需要先部署预言机
    ethers.ZeroAddress,
    true
  ];

  console.log("正在部署 Auction 代理合约...");

  const auctionProxy = await upgrades.deployProxy(
    Auction,
    initParams, // 这是传递给 initialize 函数的参数
    {
      initializer: "initialize"  
    }
  );

  await auctionProxy.waitForDeployment();

  const auctionProxyAddress = await auctionProxy.getAddress();
  const auctionImplAddress = await upgrades.erc1967.getImplementationAddress(auctionProxyAddress);

  console.log("Auction 实现合约地址:", auctionImplAddress);
  console.log("Auction 代理合约地址:", auctionProxyAddress);
  console.log("✅ Auction 部署完成");

  // --- 保存 ABI 和地址信息 ---
  const storePath = path.resolve(__dirname, "../.cache/AuctionImplementation.json");
  const data = JSON.stringify({
    abi: JSON.parse(Auction.interface.formatJson()), // 正确获取 ABI 的方式
    address: auctionProxyAddress,
    implementation: auctionImplAddress,
  }, null, 2);
  fs.writeFileSync(storePath, data, { flag: 'w' }); // 使用 'w' 标志确保文件被覆盖
  console.log(`Auction 地址和 ABI 已保存到: ${storePath}`);

  // 保存部署信息，以便在其他脚本中通过 get("Auction") 获取
  await deployments.save("Auction", {
    abi: JSON.parse(Auction.interface.formatJson()),
    address: auctionProxyAddress,
    implementation: auctionImplAddress,
  });
};

module.exports.tags = ["deployAuction"];