// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// 1. 最优先：导入 OpenZeppelin 的 IERC165（解决重复声明核心）
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

// 2. 再导入 CCIP 相关合约（此时会复用上面的 IERC165）
import "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";

// 3. 然后导入 OpenZeppelin 升级合约和标准合约
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

// 4. 最后导入本地合约和 Chainlink 价格预言机接口
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol"; // PriceOracle 依赖
import "./PriceOracle.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract Auction is UUPSUpgradeable, OwnableUpgradeable,ReentrancyGuardUpgradeable {
    
    // 拍卖状态
    enum AuctionStatus {
        PENDING, // 未开始
        ACTIVE,  // 进行中
        ENDED    // 已结束
    }
    PriceOracle public priceOracle;
    // 支付代币类型地址
    address public paymentToken; 
    uint256 NFTId;
    address NFTContract;
    //开始时间
    uint256 startTime;
    //持续事件（秒）
    uint256 duration;
    //起拍价
    uint256 price;
    //当前价格USDT
    uint256 currentUSDTPrice;
    uint256 currentPrice;
    //当前拍卖人
    address currentBidder;
    AuctionStatus public status;
    // CCIP Router 地址（跨链桥核心地址）
    
    
    // 支持的链
    mapping(uint64 => bool) public supportedChains;
    // 不同链的同一种代币地址不一样，需要记录
    mapping(uint64 => mapping(address => address)) public chainTokenMap;
    // 记录跨链资金到账情况（代币地址 => 已到账金额）
    mapping(address => uint256) public crossChainFunds;
    
    function initialize(
        uint256 _duration, 
        uint256 _startPrice, 
        address _nftContract, 
        uint256 _tokenId,
        address _realOwner,
        address _priceOracle,
        address _paymentToken,
        bool _isDeployed
        ) public initializer {
        __Ownable_init();          // 1. 初始化权限（设置 deployer 为临时 owner）
        __ReentrancyGuard_init();  // 2. 初始化防重入
        __UUPSUpgradeable_init();  // 3. 初始化 UUPS（依赖 Ownable 权限）
        if(!_isDeployed){
            createAuction(_duration, _startPrice, _nftContract, _tokenId, _realOwner);
        }
        //将权限给真正的拥有者
        _transferOwnership(_realOwner);
        priceOracle = PriceOracle(_priceOracle);
        //计算初始USDT价格
        //currentUSDTPrice = priceOracle.getPriceInUSD(_paymentToken, _startPrice);
        currentUSDTPrice = _startPrice;
        paymentToken = _paymentToken;
    }
    
    // 必须重写此函数以保护升级权限
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
    // 卖家设置支持的支付链
    function addSupportedChain(uint64 chainSelector) external onlyOwner {
        supportedChains[chainSelector] = true;
    }

    //创建拍卖
    function createAuction(
        uint256 _duration, 
        uint256 _startPrice, 
        address _nftContract,
        uint256 _tokenId,
        address _realOwner) public onlyOwner{
        require(_duration > 60, "duration must be greater than 60s");
        require(_startPrice > 0, "startPrice must be greater than 0");
        require(IERC721(_nftContract).ownerOf(_tokenId) == _realOwner, "realOwner is not NFT owner");
        
        NFTId = _tokenId;
        NFTContract= _nftContract;
        startTime= block.timestamp;
        duration= _duration;
        price = _startPrice;
        currentPrice= _startPrice;
        currentBidder= address(0);
        status= AuctionStatus.PENDING;
    }
    //开始拍卖
    function startAuction(uint256 _tokenId) public onlyOwner{
        require(status == AuctionStatus.PENDING, "Auction is not pending");
        // 使用 string.concat (推荐，更直观)
        require(
            IERC721(NFTContract).getApproved(_tokenId) == address(this),
            string.concat(
                "Auction contract address: ",
                Strings.toHexString(uint256(uint160(address(this))), 20), // 将地址转换为十六进制字符串
                ". Please call the 'approve' function on the NFT contract directly with this address and your tokenId."
            )
        );
        status = AuctionStatus.ACTIVE;
        startTime= block.timestamp;
    }
    //出价
    function bid(uint256 _amount, address _paymentToken) public payable nonReentrant{
        require(status == AuctionStatus.ACTIVE, "Auction is not active");
        require(block.timestamp <= startTime + duration, "Auction has ended");
        require(_amount > 0, "Bid amount must be > 0");

        //uint256 payAmount = priceOracle.getPriceInUSD(_paymentToken, _amount);
        uint256 payAmount = _amount*1;
        require(payAmount > currentUSDTPrice, "Bid must be greater than current price");
       
        //判断是否是ETH
        if(_paymentToken == address(0)){
            require(msg.value == _amount, "ETH amount must be equal to bid amount");
        }else{
            require(IERC20(_paymentToken).transferFrom(msg.sender, address(this), _amount), "Transfer failed");
        }
        
        
        //退换前一次出价
        if(currentBidder != address(0)){
            //ETH
            if(paymentToken == address(0)){
                payable(currentBidder).transfer(currentPrice);
            }else{
                //ERC20
                IERC20(paymentToken).transfer(currentBidder, currentPrice);
            }
            
        }
        currentBidder = msg.sender;
        currentPrice = _amount;
        currentUSDTPrice = payAmount;
        paymentToken = _paymentToken;
    }
    // 卖家设置跨链代币映射（源链Selector + 源链代币地址 → 目标链代币地址）
    function setChainTokenMap(uint64 sourceChainSelector, address sourceToken, address targetToken) external onlyOwner{
        chainTokenMap[sourceChainSelector][sourceToken] = targetToken;
    }
    // CCIP接收处理函数 - 处理跨链出价
    function _ccipReceive(Client.Any2EVMMessage memory message) internal{
        require(status == AuctionStatus.ACTIVE, "Auction not active");
        require(block.timestamp <= startTime + duration, "Auction ended");
        require(supportedChains[message.sourceChainSelector], "Chain not supported");

         // 2. 解码跨链消息（包含：买家地址、源链代币地址、源链出价金额）
        (address crossChainBidder, address sourceToken, uint256 sourceAmount) = abi.decode(
            message.data,
            (address, address, uint256)
        );

        // 3. 映射目标链代币地址（源链代币 → 目标链代币）查找来源链的的对应代币在本链的地址
        address targetToken = chainTokenMap[message.sourceChainSelector][sourceToken];
        require(targetToken != address(0), "Token not mapped for this chain");

        // 4. 执行跨链出价（调用适配跨链的出价逻辑）
        crossChainBid(crossChainBidder, sourceAmount, targetToken);
    }
    // 跨链出价专用函数
    function crossChainBid(address bidder, uint256 amount, address _paymentToken) internal {
        // 1. 计算出价的USDT价格（比价逻辑不变）
        uint256 bidUsdtPrice = priceOracle.getPriceInUSD(_paymentToken, amount);
        require(bidUsdtPrice > currentUSDTPrice, "Bid too low");

        // 2. 退款前出价者（逻辑不变，但需用目标链代币）
        if (currentBidder != address(0)) {
            if (_paymentToken == address(0)) {
                // 原生代币退款
                (bool success, ) = currentBidder.call{value: currentPrice}("");
                require(success, "Native token refund failed");
            } else {
                // ERC20退款
                require(
                    IERC20(_paymentToken).transfer(currentBidder, currentPrice),
                    "ERC20 refund failed"
                );
            }
        }

        // 3. 更新拍卖状态（记录跨链买家和资金）
        currentBidder = bidder;
        currentPrice = amount;
        currentUSDTPrice = bidUsdtPrice;
        paymentToken = _paymentToken;
        // 注意：跨链出价不覆盖全局paymentToken，避免同链和跨链出价冲突
        // 建议新增 `currentCrossChainToken` 变量记录跨链支付代币
    }
    //结束拍卖
    function endAuction() public onlyOwner{
        require(status == AuctionStatus.ACTIVE, "Auction is not active");
        require(block.timestamp > startTime + duration, "Auction has not ended");

        status = AuctionStatus.ENDED;
        if(currentBidder != address(0)){
            //将NFT转给当前出价人
            IERC721(NFTContract).safeTransferFrom(owner(), currentBidder, NFTId);
            //将钱转给拥有者
            if(paymentToken == address(0)){
                payable(owner()).transfer(currentPrice);
            }else{
                IERC20(paymentToken).transfer(owner(), currentPrice);
            }
        }
    }
    function getStatus() public view returns (AuctionStatus) {
        return status;
    }
}