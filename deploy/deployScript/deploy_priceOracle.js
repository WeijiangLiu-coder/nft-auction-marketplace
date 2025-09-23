const { ethers} = require("hardhat")


module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deployer } = await getNamedAccounts();
    console.log("部署者地址",deployer);
    const NFT = await ethers.getContractFactory("PriceOracle")
    const nft = await NFT.deploy();
    await nft.waitForDeployment();
    const nftImplAddress = await nft.getAddress();
    console.log("PriceOracle deployed to:", nftImplAddress);

    // 保存实现合约地址到部署记录（方便后续 Factory 调用）
    await deployments.save("PriceOracle", {
        abi: NFT.interface.format("json"),
        address: nftImplAddress,
    });
    
};
// add tags and dependencies
module.exports.tags = ["deployPriceOracle"];