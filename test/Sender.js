const helpers = require("@nomicfoundation/hardhat-network-helpers");
const { expect }   = require('chai')
const { anyValue } = require('@nomicfoundation/hardhat-chai-matchers/withArgs')


describe("Sender", function () {
  before(async function() {
    if (hre.network.config.chainId != 11155111) this.skip()

    await network.provider.request({
      method: 'hardhat_reset',
      params: [
        {
          forking: {
            jsonRpcUrl:  hre.network.config.forking.url,
            blockNumber: 4503700
          },
        },
      ],
    });
  })

  it("Should check fee for message and send message", async function () {
    mumbaiSelector = 12532609583862916517n
    payload = '0x0000000000000000000000001cc86b9b67c93b8fa411554db761f68979e7995a000000000000000000000000f1e3a5842eeef51f2967b3f05d45dd4f4205ff4000000000000000000000000000000000000000000000000000000000000003e8'

    // CCIP-BnM holder
    owner = await ethers.getImpersonatedSigner('0xDEbC1a9398b46555Ffb8AA02096dd9b9aD6de71B')
    deployer = await ethers.getImpersonatedSigner('0x1111111111111111111111111111111111111111')
    await helpers.setBalance(deployer.address, 100n ** 18n);
    await helpers.setBalance(owner.address, 100n ** 18n);

    link = await hre.ethers.getContractAt('@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20', '0x779877A7B0D9E8603169DdbD7836e478b4624789', owner)
    ccip = await hre.ethers.getContractAt('@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20', '0xFd57b4ddBf88a4e07fF4e34C487b99af2Fe82a05', owner)

    factory = await hre.ethers.getContractFactory('Sender', deployer)
    sender = await factory.deploy('0xD0daae2231E9CB96b94C8512223533293C3693Bf', link.target)

    await helpers.mine(1)
    await sender.waitForDeployment()

    await sender.whitelistDestination(mumbaiSelector, sender.target || sender.address) // allow same address just to test

    await link.approve(sender.target, 1e18.toString())
    await ccip.approve(sender.target, 1e18.toString())

    const originalGasLimit = await sender.fixedGasLimit()

    // 4503704
    fee = await sender.feeFor(
      mumbaiSelector,
      sender.target,
      payload,
      ccip.target,
      1000,
      link.target
    )

    expect(fee).to.be.greaterThan(0.07e18.toString()) // ~0.5$ gasFee

    await sender.setFixedGasLimit(1)

    const feeWithGasLimit = await sender.feeFor(
      mumbaiSelector,
      sender.target,
      payload,
      ccip.target,
      1000,
      link.target
    )

    expect(feeWithGasLimit).to.be.lessThan(fee)

    await sender.setFixedGasLimit(originalGasLimit)

    const linkBal = await link.balanceOf(owner.address)
    const ccipBal = await ccip.balanceOf(owner.address)

    await expect(sender.connect(owner).sendMessagePayLINK(
      mumbaiSelector,
      sender.target,
      payload,
      ccip.target,
      1000
    )).to.emit(
      sender, 'MessageSent'
    ).withArgs(
      anyValue,
      mumbaiSelector,
      sender.target,
      payload,
      ccip.target,
      1000,
      link.target,
      fee
    )

    expect(await link.balanceOf(owner.address)).to.be.within(
      linkBal - BigInt(0.08e18), linkBal - BigInt(0.07e18)
    )
    expect(await ccip.balanceOf(owner.address)).to.be.equal(ccipBal - BigInt(1000))
  });
});
