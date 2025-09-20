// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/proxy/Clones.sol"; // 最小代理模式（省 gas）
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import "./Auction.sol"; // 引入上面的 Auction 子合约

contract AuctionFactory is UUPSUpgradeable, OwnableUpgradeable {
    UpgradeableBeacon public beacon; // 代理合约
    address[] public allAuctions;

    constructor() {
        _disableInitializers();
    }

    function initialize(address _implementation) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();

        beacon = new UpgradeableBeacon(_implementation);

    }
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
    // 创建新拍卖
    function createAuction(
        uint256 _tokenId,
        address _nftContract,
        address _paymentToken,
        uint256 _startPrice,
        uint256 _duration,
        address _priceOracle) public returns (address) {
        // 创建新的BeaconProxy
        BeaconProxy auctionProxy = new BeaconProxy(
            address(beacon),
            abi.encodeWithSelector(Auction.initialize.selector,
            _duration,
            _startPrice,
            _nftContract,
            _tokenId,
            msg.sender,
            _priceOracle)
        );
        //获取其地址
        address auctionAddress = address(auctionProxy);
        allAuctions.push(auctionAddress);
        // 转移所有权给调用者
        Auction(auctionAddress).transferOwnership(msg.sender);
        return auctionAddress;
    }
    
    // 获取所有拍卖地址
    function getAllAuctions() public view returns (address[] memory) {
        return allAuctions;
    }
    // 升级实现合约（只有owner可以调用）
    function upgradeImplementation(address _newImplementation) public onlyOwner {
        beacon.upgradeTo(_newImplementation);
    }
}