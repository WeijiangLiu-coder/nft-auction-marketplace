// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";


contract NFT is ERC721,ERC721URIStorage,Ownable {

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
        //调用ERC721的_mint方法
        _mint(to, _tokenIds);
        _ownerTokens[to].push(_tokenIds);
        //调用ERC721URIStorage的_setTokenURI方法
        _setTokenURI(newTokenId, tokenUrl);
        return _tokenIds;
    }
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, ERC721URIStorage) returns (bool){
        return super.supportsInterface(interfaceId);
    }
}