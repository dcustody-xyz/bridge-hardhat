const helpers = require("@nomicfoundation/hardhat-network-helpers");
const { expect }   = require('chai')
const { anyValue } = require('@nomicfoundation/hardhat-chai-matchers/withArgs')
const fs = require('fs')

const { tenderly } = require("hardhat");


describe("Receiver", function () {
  before(function() {
    // if (hre.network.config.chainId != 80001) this.skip()
  })

  it("Should check fee for message and send message", async function () {
    // BLOCKNUMBER 41365593
    sepoliaSelector = 16015286601757825753n
    // payload = '0x0000000000000000000000001cc86b9b67c93b8fa411554db761f68979e7995a000000000000000000000000f1e3a5842eeef51f2967b3f05d45dd4f4205ff4000000000000000000000000000000000000000000000000000000000000003e8'

    // CCIP-BnM holder
    deployer = await ethers.getImpersonatedSigner('0x1111111111111111111111111111111111111111') // Chainlink caller
    chainlinkBridge = await ethers.getImpersonatedSigner('0xdc2050035fbdd0a7b834e7e9b90ff35cbd752731') // Chainlink caller
    router = await ethers.getImpersonatedSigner('0x70499c328e1E2a3c41108bd3730F6670a44595D1')
    router.target = router.address
    await helpers.setBalance(deployer.address, 100n ** 18n);

    link = await hre.ethers.getContractAt('@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20', '0x326C977E6efc84E512bB9C30f76E30c160eD06FB')
    ccip = await hre.ethers.getContractAt('@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20', '0xf1E3A5842EeEF51F2967b3F05D45DD4f4205FF40')

    factory = await hre.ethers.getContractFactory('Receiver', deployer)
    receiver = await factory.deploy(router.target || router.address, link.target || link.address)
    factoryS = await hre.ethers.getContractFactory('Swapper', deployer)
    swapper = await factoryS.deploy()

    await helpers.mine(1)
    // await receiver.waitForDeployment()
    // await swapper.waitForDeployment()
    expect(receiver.target || receiver.address).to.be.equal("0x8F7a45eBDe059392E46A46DCc14AB24681A961Ea")

    await receiver.whitelistSource(sepoliaSelector, '0xd895ea725e460785290f460ca9302b23ca548843')
    await receiver.setSwapper(swapper.target || swapper.address, swapper.target || swapper.address)

    // receiverAddr = receiver.target || receiver.address.substring(2)

    // offRampAbi = JSON.parse(fs.readFileSync('./node_modules/@chainlink/contracts-ccip/abi/v0.8/EVM2EVMOffRamp.json'))
    // evmOffRamp = await ethers.getContractAt(
    //   offRampAbi,

    const recBal = await ccip.balanceOf(receiver.target || receiver.address)

    const aaveDai = await ethers.getContractAt('@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20', '0xc8c0Cf9436F4862a8F60Ce680Ca5a9f0f99b5ded');

    await swapper.setSwap(
      ccip.target || ccip.address, aaveDai.target || aaveDai.address, // from ccip to DAI
      1000, 1
    )

    // Transfer 1DAI from any holder to swapper
    await (await aaveDai.connect(
      await ethers.getImpersonatedSigner('0xb5069cc0edaf9029214d809b9c5098a39a71af40')
    ).transfer(swapper.target || swapper.address, 1)).wait()

    expect(await ccip.balanceOf(swapper.target || swapper.address)).to.be.equal('0')
    expect(await aaveDai.balanceOf('0x1cC86b9b67C93B8Fa411554DB761f68979E7995A')).to.be.equal(0)

    tx = await chainlinkBridge.sendTransaction({
      to: '0xBe582Db704Bd387222C70CA2E5A027E5E2c06fB7',
      data: fs.readFileSync('./payload').toString().trim(),
      nonce: 12390,
      gasLimit: 4e6
    })
    await helpers.mine(3)

    await tx.wait()

    expect(await ccip.balanceOf(receiver.target || receiver.address)).to.be.equal(recBal)
    expect(await ccip.balanceOf(swapper.target || swapper.address)).to.be.equal(1000)
    expect(await aaveDai.balanceOf('0x1cC86b9b67C93B8Fa411554DB761f68979E7995A')).to.be.equal(1)
  });
});
