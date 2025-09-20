const {deployments, ethers} = require("hardhat")


module.exports = async ({ getNamedAccounts, deployments }) => {
    const { save } = deployments;
    const { deployer } = await getNamedAccounts();
    console.log("部署者地址",deployer);
    const NftAuction = await ethers.getContractFactory("NftAuction")
    const nft = await NftAuction.deploy("GenShin", "Roler");
    await nft.waitForDeployment();
    console.log("NFT deployed to:", await nft.getAddress());
    //通过代理部署合约
    
};
// add tags and dependencies
module.exports.tags = ["deployNFT"];