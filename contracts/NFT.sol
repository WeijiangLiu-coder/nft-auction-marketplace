// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";


contract NFT is ERC721URIStorage,Ownable {

    uint256 private _tokenIds;
    // 2. 存储每个所有者地址对应的 tokenId 列表（示例：值类型为数组）
    mapping(address ownerAddress => uint256[] nftList) private _ownerTokens;

    constructor(
        string memory name,
        string memory symbol
    ) ERC721(name, symbol) Ownable(msg.sender){}

    function mintNFT(address to,string memory tokenUrl) public onlyOwner returns (uint256) {
        require(to != address(0), "NFT: mint to zero address");
        _tokenIds++;
        uint256 currentTokenId = _tokenIds; // 临时变量记录当前 tokenId
        
        _mint(to, currentTokenId);
        _ownerTokens[to].push(currentTokenId);
        _setTokenURI(currentTokenId, tokenUrl); // 用临时变量，逻辑更清晰
        
        return currentTokenId;
    }
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        // super.tokenURI(tokenId) 会优先调用继承链中“最后声明的基类”的函数
        // 这里因为继承顺序是 ERC721 → ERC721URIStorage，所以会使用 ERC721URIStorage 的实现
        return super.tokenURI(tokenId);
    }
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool){
        return super.supportsInterface(interfaceId);
    }
}