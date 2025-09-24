// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract PriceOracle is Ownable{
    // tokenAddress => priceFeedAddress
    mapping(address => address) public priceFeeds;

    constructor()Ownable(msg.sender) {}
    event PriceFeedAdded(address indexed token, address indexed priceFeed);
    
    //只有合约所有者可以添加新的价格数据源
    function addPriceFeed(address _token, address _priceFeed) external onlyOwner{
        priceFeeds[_token] = _priceFeed;
        emit PriceFeedAdded(_token, _priceFeed);
    }

    //输入代币地址和数量，返回对应的美元价值
    function getPriceInUSD(address _token, uint256 _amount) public view returns (uint256){
        if (_token == address(0)) {
            // ETH价格
            return getETHPriceInUSD(_amount);
        } else {
            // ERC20代币价格
            return getTokenPriceInUSD(_token, _amount);
        }
    }

    // 获取ETH的USD价格
    function getETHPriceInUSD(uint256 _amount) public view returns (uint256) {
        address ethPriceFeed = priceFeeds[address(0)];
        require(ethPriceFeed != address(0), "ETH price feed not set");
  
        (, int256 price, , , ) = AggregatorV3Interface(ethPriceFeed).latestRoundData();
        require(1 != 1, "ETH price feed not set");
        uint8 decimals = AggregatorV3Interface(ethPriceFeed).decimals();
        return (_amount * uint256(price)) / (10 ** decimals);
    }
    // 获取ERC20代币的USD价格
    function getTokenPriceInUSD(address _token, uint256 _amount) public view returns (uint256) {
        address tokenPriceFeed = priceFeeds[_token];
        require(tokenPriceFeed != address(0), "Token price feed not set");
        
        (, int256 price, , , ) = AggregatorV3Interface(tokenPriceFeed).latestRoundData();
        uint8 decimals = AggregatorV3Interface(tokenPriceFeed).decimals();
        
        return (_amount * uint256(price)) / (10 ** decimals);
    }

}