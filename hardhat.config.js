require("dotenv").config();
require("hardhat-deploy");
require("@openzeppelin/hardhat-upgrades");
require("@nomicfoundation/hardhat-toolbox-viem");
require("hardhat-coverage");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    sepolia:{
      url:`https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts:[process.env.PK]
    }
  },
    namedAccounts: {
      deployer: 0,
      user1: 1,
      user2: 2,
      user3: 3,
  },
  coverage: {
    include: ["./contracts/MetaNodeStake.sol"],
  }
};
